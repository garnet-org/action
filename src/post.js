import * as core from "@actions/core"
import * as exec from "@actions/exec"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import {
    firstNonEmptyString,
    getEnv,
    getErrorMessage,
    getOptionalNumber,
    getOptionalRecord,
    getOptionalString,
    isSupportedArch,
    isSupportedPlatform,
    pathExists,
    waitForDelay,
} from "./shared.js"
import { getPullRequestNumberFromEvent } from "./github-event.js"
import { ControlPlaneClient } from "./control-plane/client.js"
import { uploadJibrilArtifacts } from "./post-artifacts.js"
import { buildReportLink, getDefaultJsonProfileFile, parseProfileJson, resolveAppBaseURL } from "./profile-comment.js"
import { profilePermalink, renderPendingReview, renderStepSummary, summarizeProfile } from "./runtime-review.js"
import { publishPullRequestComment } from "./pr-comment.js"
import { OIDC_AUTH_FEATURE_FLAG, getGitHubIDToken, resolveOIDCAudience } from "./oidc.js"
import { isCommentPermissionError } from "./pr-comment-error.js"
import { parseSystemdTimespanSeconds } from "./systemd-timespan.js"

/** @typedef {import("./profile-comment.js").NormalizedProfile} NormalizedProfile */
/** @typedef {import("./profile-comment.js").RenderOptions} RenderOptions */

/**
 * @typedef {{ normalized: NormalizedProfile, raw: unknown }} LoadedProfile
 */

/**
 * @typedef {{
 *   statusCode?: number
 *   apiCode?: string
 * }} GitHubApiErrorDetails
 */

const JSON_PROFILE_LABEL = "JSON profile"
const DOCS_URL = "https://github.com/garnet-org/action#readme"

// On stop, jibril reprocesses every remaining task and flow and writes the
// JSON profile only when that flush completes, so on long jobs
// `systemctl stop` can block for several minutes. The unit itself bounds the
// flush (TimeoutStopSec, raised by the main step's drop-in; systemd SIGKILLs
// past it), so the post
// step waits for the stop to complete — aligned to the unit's own deadline
// plus a small grace — rather than abandoning a still-deactivating service
// and losing the profile. The bound stays overridable for consumers that
// prefer a shorter post step over profile capture on heavy jobs.
const STOP_TIMEOUT_ENV = "GARNET_POST_STOP_TIMEOUT_SECONDS"
const FALLBACK_STOP_TIMEOUT_SECONDS = 1800
const STOP_TIMEOUT_GRACE_SECONDS = 30
const PROFILE_WAIT_ENV = "GARNET_POST_PROFILE_WAIT_SECONDS"
const DEFAULT_PROFILE_WAIT_SECONDS = 60
const PROFILE_POLL_INTERVAL_MS = 5000
const STOP_TIMED_OUT_EXIT_CODE = 124

// This is the post step for the action. It is called by the GitHub Actions
// runtime. It stops the Jibril service so the daemon flushes all pending events
// and writes the JSON profile before we read it. It then renders the Garnet
// Runtime Summary (Step Summary) and publishes the Garnet Runtime Review PR
// comment from the same Run Profile.

async function run() {
    const platform = os.platform()
    if (!isSupportedPlatform(platform)) {
        core.info(`Garnet runtime monitoring requires Linux (eBPF-based). Skipping post step on ${platform}.`)
        return
    }

    const arch = os.arch()
    if (!isSupportedArch(arch)) {
        core.info(
            `Garnet runtime monitoring requires x86_64 (jibril is only available for amd64). Skipping post step on ${arch}.`,
        )
        return
    }

    try {
        const jibrilStarted = core.getState("jibrilStarted") === "true"

        // Remove secrets from disk (best-effort). Important for self-hosted runners.
        await exec.exec("sudo", ["rm", "-f", "/etc/default/jibril"], {
            ignoreReturnCode: true,
        })

        if (!jibrilStarted) {
            core.info("Jibril did not start in the main step, skipping post-step runtime processing.")
            return
        }

        const jsonProfilerFile = firstNonEmptyString(core.getState("jsonProfilerFile"), getDefaultJsonProfileFile())

        // Stop the Jibril service and wait for the stop to complete so the
        // daemon flushes all pending events and writes the JSON profile. The
        // wait is aligned to the unit's own stop deadline (TimeoutStopSec)
        // plus a grace period, because the profile is written only when the
        // flush completes: abandoning a still-deactivating service loses it.
        const stopTimeoutSeconds = await resolveStopTimeoutSeconds()
        const stopStart = Date.now()
        core.info(`stopping jibril service (waiting up to ${stopTimeoutSeconds}s for the event flush to complete)`)
        const stopExitCode = await exec.exec(
            "sudo",
            ["timeout", `${stopTimeoutSeconds}s`, "systemctl", "stop", "jibril.service"],
            {
                ignoreReturnCode: true,
            },
        )
        core.info(`jibril service stop finished in ${Math.round((Date.now() - stopStart) / 1000)}s`)

        const profileWaitSeconds = parsePositiveInteger(getEnv(PROFILE_WAIT_ENV), DEFAULT_PROFILE_WAIT_SECONDS)
        if (stopExitCode === STOP_TIMED_OUT_EXIT_CODE) {
            core.info(
                `jibril was still flushing its event backlog after ${stopTimeoutSeconds}s (set ${STOP_TIMEOUT_ENV} to change the bound); ` +
                    `waiting up to ${profileWaitSeconds}s more for the ${JSON_PROFILE_LABEL} at ${jsonProfilerFile}`,
            )
        }

        // The profile file is written by the daemon as its final act before
        // exiting; a short poll covers the race between the stop returning
        // and the file landing on disk.
        const appeared = await waitForRootFile(jsonProfilerFile, profileWaitSeconds * 1000)
        if (!appeared) {
            core.info(
                `${JSON_PROFILE_LABEL} was not written within the bounded wait; ` +
                    "the Runtime Review below is rendered without this run's profile",
            )
        }

        await logJibrilServiceState()

        // Upload jibril logs as artifacts when debug is enabled (only after service stops).
        // Get the debug state from the main.js.
        const debug = core.getState("debug")
        if (debug === "true") {
            await uploadJibrilArtifacts()
        }

        const profile = await readProfile(jsonProfilerFile, debug === "true")
        const renderOptions = getRenderOptions()

        if (profile !== null) {
            const envelopeID = await resolveProfileEnvelopeID()
            if (envelopeID !== "") {
                // The raw on-disk Jibril profile has no control-plane envelope
                // ID; wrapping it threads the ID into every render so the
                // exact public profile selector resolves.
                profile.raw = { id: envelopeID, data: profile.raw }
            }
        }

        await appendRuntimeReviewSummary(profile, renderOptions)
        if (profile !== null) {
            logProfileReportLink(profile)
            await publishProfilerComment(profile.normalized, renderOptions)
        }
    } catch (err) {
        // Never fail the job because of the Runtime Review step.
        core.warning(`failed to write Runtime Review summary: ${getErrorMessage(err)}`)
    }
}

/**
 * Reads and parses the JSON profile produced by Jibril, or null when the
 * profile is missing or unreadable. Returns both the raw parsed JSON (the
 * Step Summary renders the full-detail report from it, v6.1 §8) and the
 * normalized shape used by the PR-comment state machinery.
 * @param {string} jsonProfilerFile
 * @param {boolean} debug
 * @returns {Promise<LoadedProfile | null>}
 */
async function readProfile(jsonProfilerFile, debug) {
    try {
        const jsonProfile = await readOptionalRootFile(jsonProfilerFile)
        if (jsonProfile === "") {
            core.info(`${JSON_PROFILE_LABEL} not found: ${jsonProfilerFile}`)
            return null
        }

        if (debug) {
            core.info(`${JSON_PROFILE_LABEL} contents:`)
            core.info(jsonProfile)
        }

        return {
            normalized: parseProfileJson(jsonProfile),
            raw: JSON.parse(jsonProfile),
        }
    } catch (error) {
        core.warning(`failed to read ${JSON_PROFILE_LABEL}: ${getErrorMessage(error)}`)
        return null
    }
}

/**
 * Resolves the control-plane envelope ID for this run's profile by listing
 * the profiles recorded for the agent created in the main step. Fail-closed:
 * any missing credential, missing agent, ambiguity, or request failure
 * returns "" and the render keeps its existing linkless behavior.
 * @returns {Promise<string>}
 */
async function resolveProfileEnvelopeID() {
    const agentID = core.getState("agentID")
    if (agentID === "") {
        return ""
    }

    const baseURL = firstNonEmptyString(getEnv("GARNET_API_URL"), core.getInput("api_url"), "https://api.garnet.ai")
    const projectToken = firstNonEmptyString(core.getInput("api_token"), getEnv("GARNET_API_TOKEN"))
    const workflowToken = projectToken === "" ? await resolvePostWorkflowToken(baseURL) : ""
    if (projectToken === "" && workflowToken === "") {
        return ""
    }

    const runID = getEnv("GITHUB_RUN_ID")
    if (runID === "") {
        return ""
    }

    try {
        const client = new ControlPlaneClient({
            baseURL,
            projectToken,
            workflowToken,
        })

        const page = await client.agentProfiles(agentID, {
            runID,
            runAttempt: getEnv("GITHUB_RUN_ATTEMPT"),
        })

        // The main step creates one agent per job, so the agent's profile
        // list for this run must resolve to exactly one envelope; anything
        // else is ambiguous and the render stays linkless.
        const matches = page.items.filter((item) => item.runID === "" || item.runID === runID)
        const match = matches.length === 1 ? matches[0] : undefined
        if (match === undefined) {
            return ""
        }

        return match.id
    } catch (error) {
        core.info(`profile envelope lookup skipped: ${getErrorMessage(error)}`)
        return ""
    }
}

/**
 * Exchanges a fresh GitHub OIDC ID token for a control-plane workflow token,
 * for the post step's profile envelope lookup. The token is never persisted
 * between steps; the post step performs its own exchange. Fail-closed: flag
 * off, missing permission, or any exchange failure returns "".
 * @param {string} baseURL
 * @returns {Promise<string>}
 */
async function resolvePostWorkflowToken(baseURL) {
    const useOIDCAuth = getEnv(OIDC_AUTH_FEATURE_FLAG, "false") === "true"
    if (useOIDCAuth !== true) {
        return ""
    }

    try {
        const idToken = await getGitHubIDToken(resolveOIDCAudience(baseURL))
        const client = new ControlPlaneClient({ baseURL })
        const exchanged = await client.exchangeGitHubOIDCForWorkflowToken(idToken)
        if (exchanged.workflowToken !== "") {
            core.setSecret(exchanged.workflowToken)
        }
        return exchanged.workflowToken
    } catch (error) {
        core.info(`post-step OIDC exchange skipped: ${getErrorMessage(error)}`)
        return ""
    }
}

/**
 * Render options for this publish flow; the clock is pinned once so every
 * render in the flow produces identical bytes.
 * @returns {RenderOptions}
 */
function getRenderOptions() {
    return { renderedAt: new Date() }
}

/**
 * Writes the Garnet Runtime Summary — the per-run full-detail tabular
 * record (v6.1 §8) — to the GitHub Step Summary, rendered from the RAW
 * parsed profile. When no profile was produced, the waiting-state body
 * (v6.1 §2) is written instead, markerless and with the explainer
 * collapsed.
 * @param {LoadedProfile | null} profile
 * @param {RenderOptions} renderOptions
 * @returns {Promise<void>}
 */
async function appendRuntimeReviewSummary(profile, renderOptions) {
    const summaryFile = getEnv("GITHUB_STEP_SUMMARY")
    if (summaryFile === "") {
        core.warning("GITHUB_STEP_SUMMARY is not set, cannot write summary")
        return
    }

    let content
    if (profile === null) {
        const sha = getEnv("GITHUB_SHA")
        const repository = getEnv("GITHUB_REPOSITORY")
        content = renderPendingReview({
            sha,
            commitUrl: repository !== "" && sha !== "" ? `https://github.com/${repository}/commit/${sha}` : "",
        })
    } else {
        const preview = core.getState("preview") === "true"
        content = renderStepSummary([profile.raw], { appUrl: resolveAppBaseURL(), preview })
    }

    await fs.appendFile(summaryFile, `\n${content}\n`)
    core.info("Garnet Runtime Summary written to job summary")
}

/**
 * Logs the public Run Profile report link to the job log so it is reachable
 * from every run (push, schedule, forks without comment permissions), not
 * only from PR comments and the Step Summary. The exact per-profile selector
 * is preferred when the profile carries an envelope ID; otherwise the
 * run-level report link is logged. The page enforces the fail-closed
 * publication policy, so the URL resolves only for public, consented
 * profiles.
 * @param {LoadedProfile} profile
 * @returns {void}
 */
function logProfileReportLink(profile) {
    const job = summarizeProfile(profile.raw)

    let link = ""
    if (job !== null) {
        link = profilePermalink(job, resolveAppBaseURL(), "ci_log")
    }

    if (link === "") {
        link = buildReportLink({
            repository: getEnv("GITHUB_REPOSITORY"),
            run_id: getEnv("GITHUB_RUN_ID"),
            job: getEnv("GITHUB_JOB"),
        })
    }

    if (link === "") {
        return
    }

    core.info(`Garnet Run Profile report: ${link}`)
}

/**
 * @param {NormalizedProfile} profile
 * @param {RenderOptions} renderOptions
 * @returns {Promise<void>}
 */
async function publishProfilerComment(profile, renderOptions) {
    const eventPath = getEnv("GITHUB_EVENT_PATH")
    if (eventPath === "") {
        core.info("GITHUB_EVENT_PATH is not set, skipping PR comment")
        return
    }

    const repository = getEnv("GITHUB_REPOSITORY")
    if (repository === "") {
        core.warning("GITHUB_REPOSITORY is not set, skipping PR comment")
        return
    }

    const token = firstNonEmptyString(core.getState("githubToken"), getEnv("GITHUB_TOKEN"))
    if (token === "") {
        core.warning("github_token is not set, skipping PR comment")
        return
    }

    const pullRequestNumber = await getPullRequestNumberFromEvent(eventPath)
    if (pullRequestNumber === null) {
        core.info("workflow is not running for a pull request, skipping PR comment")
        return
    }

    const runAttempt = parseRunAttempt(getEnv("GITHUB_RUN_ATTEMPT"))

    try {
        const result = await publishPullRequestComment({
            repository,
            pullRequestNumber,
            token,
            profile,
            runAttempt,
            renderOptions,
        })
        core.info(`PR comment ${result}`)
    } catch (error) {
        if (isCommentPermissionError(error)) {
            core.info(
                "PR comment skipped: the workflow token cannot comment on this pull request. " +
                    "The Garnet GitHub App is the supported comment path and needs no workflow permissions: " +
                    "https://github.com/apps/garnet-runtime-review/installations/select_target. " +
                    "To publish from this action instead, grant this workflow `pull-requests: write`.",
            )
            return
        }
        core.warning(`failed to publish PR comment: ${formatPullRequestCommentPublishError(error)}`)
    }
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function formatPullRequestCommentPublishError(error) {
    const details = getGitHubApiErrorDetails(error)
    const messageParts = [getErrorMessage(error)]

    if (details.statusCode !== undefined) {
        messageParts.push(`status=${details.statusCode}`)
    }
    if (details.apiCode !== undefined) {
        messageParts.push(`api_code=${details.apiCode}`)
    }

    return messageParts.join("; ")
}

/**
 * @param {unknown} error
 * @returns {GitHubApiErrorDetails}
 */
function getGitHubApiErrorDetails(error) {
    const errorRecord = getOptionalRecord(error)
    if (errorRecord === null) {
        return {}
    }

    const details = {}

    const statusCode = getOptionalNumber(errorRecord.status)
    if (statusCode !== undefined) {
        details.statusCode = statusCode
    }

    const response = getOptionalRecord(errorRecord.response)
    if (response !== null) {
        if (details.statusCode === undefined) {
            const responseStatus = getOptionalNumber(response.status)
            if (responseStatus !== undefined) {
                details.statusCode = responseStatus
            }
        }

        const responseData = getOptionalRecord(response.data)
        if (responseData !== null) {
            const directCode = getOptionalString(responseData.code)
            if (directCode !== undefined) {
                details.apiCode = directCode
            } else {
                const nestedCode = getApiCodeFromErrorList(responseData.errors)
                if (nestedCode !== undefined) {
                    details.apiCode = nestedCode
                }
            }
        }
    }

    if (details.apiCode === undefined) {
        const topLevelCode = getOptionalString(errorRecord.code)
        if (topLevelCode !== undefined) {
            details.apiCode = topLevelCode
        }
    }

    return details
}

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
function getApiCodeFromErrorList(value) {
    if (!Array.isArray(value)) {
        return undefined
    }

    for (const item of value) {
        const record = getOptionalRecord(item)
        if (record === null) {
            continue
        }

        const code = getOptionalString(record.code)
        if (code !== undefined) {
            return code
        }
    }

    return undefined
}

/**
 * Polls until the file exists with non-empty content or the deadline
 * passes. Returns true when the file appeared.
 * @param {string} filePath
 * @param {number} deadlineMs
 * @returns {Promise<boolean>}
 */
async function waitForRootFile(filePath, deadlineMs) {
    const deadline = Date.now() + deadlineMs
    for (;;) {
        const content = await readOptionalRootFile(filePath)
        if (content !== "") {
            return true
        }
        if (Date.now() >= deadline) {
            return false
        }
        await waitForDelay(PROFILE_POLL_INTERVAL_MS)
    }
}

/**
 * Logs the jibril unit state so runs with a missing or partial profile
 * carry enough context to diagnose (still deactivating, killed on the
 * stop timeout, or exited cleanly).
 * @returns {Promise<void>}
 */
async function logJibrilServiceState() {
    try {
        const result = await exec.getExecOutput(
            "sudo",
            ["systemctl", "show", "jibril.service", "-p", "ActiveState", "-p", "Result", "-p", "ExecMainStatus"],
            {
                silent: true,
                ignoreReturnCode: true,
            },
        )
        const state = result.stdout.trim().split("\n").join(", ")
        if (state !== "") {
            core.info(`jibril service state: ${state}`)
        }
    } catch (error) {
        core.info(`could not read jibril service state: ${getErrorMessage(error)}`)
    }
}

/**
 * Resolves how long the post step waits for `systemctl stop` to complete.
 * An explicit environment override wins; otherwise the unit's own
 * TimeoutStopSec is read live (so the bound tracks the unit instead of a
 * hardcoded copy) plus a grace period, with a fallback when the unit
 * property is unreadable or infinite.
 * @returns {Promise<number>}
 */
async function resolveStopTimeoutSeconds() {
    const override = parsePositiveInteger(getEnv(STOP_TIMEOUT_ENV), 0)
    if (override > 0) {
        return override
    }

    try {
        const result = await exec.getExecOutput(
            "sudo",
            ["systemctl", "show", "jibril.service", "-p", "TimeoutStopUSec", "--value"],
            {
                silent: true,
                ignoreReturnCode: true,
            },
        )
        if (result.exitCode === 0) {
            const unitSeconds = parseSystemdTimespanSeconds(result.stdout.trim())
            if (unitSeconds !== null) {
                return unitSeconds + STOP_TIMEOUT_GRACE_SECONDS
            }
        }
    } catch (error) {
        core.info(`could not read jibril unit stop timeout: ${getErrorMessage(error)}`)
    }

    return FALLBACK_STOP_TIMEOUT_SECONDS + STOP_TIMEOUT_GRACE_SECONDS
}

/**
 * @param {string} value
 * @param {number} def
 * @returns {number}
 */
function parsePositiveInteger(value, def) {
    const parsedValue = Number.parseInt(value, 10)
    if (Number.isSafeInteger(parsedValue) && parsedValue > 0) {
        return parsedValue
    }
    return def
}

/**
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function readOptionalRootFile(filePath) {
    if (filePath === "") {
        return ""
    }

    try {
        return await readRootFileContent(filePath)
    } catch {
        return ""
    }
}

/**
 * @param {string} value
 * @returns {number}
 */
function parseRunAttempt(value) {
    const parsedValue = Number.parseInt(value, 10)
    return Number.isSafeInteger(parsedValue) ? parsedValue : 1
}

/**
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function readRootFileContent(filePath) {
    const result = await exec.getExecOutput("sudo", ["cat", filePath], {
        silent: true,
        ignoreReturnCode: true,
    })
    if (result.exitCode !== 0) {
        return ""
    }

    return result.stdout.trim()
}

run()
