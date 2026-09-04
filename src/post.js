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
import { getProfileJobName } from "./github-context.js"
import { ControlPlaneClient } from "./control-plane/client.js"
import { uploadJibrilArtifacts } from "./post-artifacts.js"
import { buildReportLink, getDefaultJsonProfileFile, resolveAppBaseURL } from "./profile-comment.js"
import { profilePermalink, renderPendingReview, renderStepSummary, summarizeProfile } from "./runtime-review.js"
import { publishPullRequestComment } from "./pr-comment.js"
import { getGitHubIDToken, resolveOIDCAudience } from "./oidc.js"
import { isCommentPermissionError } from "./pr-comment-error.js"
import { parseSystemdTimespanSeconds } from "./systemd-timespan.js"
import { classifyProfileContent } from "./post-profile-state.js"
import { classifyAgentStop, formatAgentStopDetail } from "./post-signal.js"
import { resolveJobStatusFromGitHub } from "./github-job-status.js"
import { resolveStopTimeoutFromSettings, resolveStopTimeoutFromUnit } from "./post-stop-timeout.js"

/** @typedef {import("./profile-comment.js").NormalizedProfile} NormalizedProfile */
/** @typedef {import("./profile-comment.js").RenderOptions} RenderOptions */
/** @typedef {import("./post-profile-state.js").LoadedProfile} LoadedProfile */
/** @typedef {import("./post-profile-state.js").ProfileResult} ProfileResult */
/** @typedef {import("./post-profile-state.js").RootFileStat} RootFileStat */
/** @typedef {import("./post-signal.js").JibrilUnitState} JibrilUnitState */
/** @typedef {import("./post-signal.js").AgentStopEvidence} AgentStopEvidence */
/** @typedef {import("./github-job-status.js").JobStatusResolution} JobStatusResolution */
/** @typedef {import("./control-plane/types.js").AgentStoppedRequest} AgentStoppedRequest */
/** @typedef {import("./control-plane/types.js").AgentStoppedJibrilFields} AgentStoppedJibrilFields */

/**
 * Everything the post step observed about how the sensor stopped, from which
 * the control-plane signal is derived.
 * @typedef {object} AgentStopObservations
 * @property {string} agentToken
 * @property {JibrilUnitState | null} unitStateBeforeStop
 * @property {JibrilUnitState | null} unitStateAfterStop
 * @property {"completed" | "timed_out"} stopOutcome
 * @property {boolean} forceStopped
 * @property {number} stopTimeoutSeconds
 * @property {ProfileResult} profileResult
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
// and losing the profile. The `stop_timeout_seconds` input is the supported
// knob; this env var stays as an advanced escape hatch and is used verbatim.
const STOP_TIMEOUT_ENV = "GARNET_POST_STOP_TIMEOUT_SECONDS"
const STOP_TIMEOUT_INPUT = "stop_timeout_seconds"

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
        const agentID = core.getState("agentID")
        const agentToken = core.getState("agentToken")
        const jsonProfilerFile = firstNonEmptyString(core.getState("jsonProfilerFile"), getDefaultJsonProfileFile())

        if (agentToken !== "") {
            core.setSecret(agentToken)
        }

        // Remove secrets from disk (best-effort). Important for self-hosted runners.
        await exec.exec("sudo", ["rm", "-f", "/etc/default/jibril"], {
            ignoreReturnCode: true,
        })

        if (!jibrilStarted) {
            core.info("Jibril did not start in the main step, skipping post-step runtime processing.")
            return
        }

        // Read before the stop as well: it is the only way to tell a sensor
        // that had already crashed from one we timed out waiting on.
        const unitStateBeforeStop = await readJibrilUnitState()
        logJibrilUnitState("jibril service state before stop", unitStateBeforeStop)

        // Stop the Jibril service and wait for the stop to complete so the
        // daemon flushes all pending events and writes the JSON profile. The
        // wait is aligned to the unit's own stop deadline (TimeoutStopSec)
        // plus a grace period, because the profile is written only when the
        // flush completes: abandoning a still-deactivating service loses it.
        const stopTimeoutSeconds = await resolvePostStopTimeoutSeconds()
        let stopArgs = ["systemctl", "stop", "jibril.service"]
        if (stopTimeoutSeconds > 0) {
            stopArgs = ["timeout", `${stopTimeoutSeconds}s`, ...stopArgs]
            core.info(`stopping jibril service (waiting up to ${stopTimeoutSeconds}s for the event flush to complete)`)
        } else {
            core.info("stopping jibril service (flush bound disabled, waiting for the event flush to complete)")
        }

        const stopStart = Date.now()
        const stopExitCode = await exec.exec("sudo", stopArgs, {
            ignoreReturnCode: true,
        })
        const stopOutcome = stopExitCode === STOP_TIMED_OUT_EXIT_CODE ? "timed_out" : "completed"
        core.info(`jibril service stop finished in ${Math.round((Date.now() - stopStart) / 1000)}s`)

        const profileWaitSeconds = parsePositiveInteger(getEnv(PROFILE_WAIT_ENV), DEFAULT_PROFILE_WAIT_SECONDS)
        if (stopOutcome === "timed_out") {
            core.info(
                `jibril was still flushing its event backlog after ${stopTimeoutSeconds}s (set the ${STOP_TIMEOUT_INPUT} input to change the bound); ` +
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

        let forceStopped = false
        if (stopOutcome === "timed_out") {
            await forceStopJibril()
            forceStopped = true
        }

        const unitStateAfterStop = await readJibrilUnitState()
        logJibrilUnitState("jibril service state", unitStateAfterStop)

        // Upload jibril logs as artifacts when debug is enabled (only after service stops).
        // Get the debug state from the main.js.
        const debug = core.getState("debug")
        if (debug === "true") {
            await uploadJibrilArtifacts()
        }

        const profileResult = await readProfile(jsonProfilerFile, debug === "true")
        const renderOptions = getRenderOptions()

        const profile = profileResult.profile
        if (profile !== null) {
            const envelopeID = await resolveProfileEnvelopeID(agentID)
            if (envelopeID !== "") {
                // The raw on-disk Jibril profile has no control-plane envelope
                // ID; wrapping it threads the ID into every render so the
                // exact public profile selector resolves.
                profile.raw = { id: envelopeID, data: profile.raw }
            }
        }

        // A run that produced no usable profile leaves the control plane's
        // pending state unresolved, so the agent reports how it stopped.
        if (profileResult.state !== "present" && agentToken !== "") {
            await reportAgentStop({
                agentToken,
                unitStateBeforeStop,
                unitStateAfterStop,
                stopOutcome,
                forceStopped,
                stopTimeoutSeconds,
                profileResult,
            })
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
 * Reads and parses the JSON profile produced by Jibril, distinguishing a
 * missing file from an empty or unparsable one so the control plane can be
 * told which of them happened.
 * @param {string} jsonProfilerFile
 * @param {boolean} debug
 * @returns {Promise<ProfileResult>}
 */
async function readProfile(jsonProfilerFile, debug) {
    try {
        const stat = await statRootFile(jsonProfilerFile)
        const jsonProfile = stat.exists ? await readOptionalRootFile(jsonProfilerFile) : ""

        if (debug && jsonProfile !== "") {
            core.info(`${JSON_PROFILE_LABEL} contents:`)
            core.info(jsonProfile)
        }

        const result = classifyProfileContent(stat, jsonProfile)
        switch (result.state) {
            case "missing":
                core.info(`${JSON_PROFILE_LABEL} not found: ${jsonProfilerFile}`)
                break
            case "empty":
                core.info(`${JSON_PROFILE_LABEL} is empty: ${jsonProfilerFile}`)
                break
            case "invalid":
                core.warning(`failed to parse ${JSON_PROFILE_LABEL}: ${result.detail}`)
                break
        }

        return result
    } catch (error) {
        core.warning(`failed to read ${JSON_PROFILE_LABEL}: ${getErrorMessage(error)}`)
        return {
            state: "invalid",
            profile: null,
            detail: getErrorMessage(error),
        }
    }
}

/**
 * Reports to the control plane that this run's sensor stopped without leaving
 * a usable Run Profile, authenticated as the agent itself. Best-effort: every
 * failure is logged and swallowed so the job stays green.
 * @param {AgentStopObservations} observations
 * @returns {Promise<void>}
 */
async function reportAgentStop(observations) {
    try {
        const jobStatus = await resolveJobStatus()

        /** @type {AgentStopEvidence} */
        const evidence = {
            jobStatus: jobStatus.status,
            unitStateBeforeStop: observations.unitStateBeforeStop,
            unitStateAfterStop: observations.unitStateAfterStop,
            stopOutcome: observations.stopOutcome,
            forceStopped: observations.forceStopped,
            stopTimeoutSeconds: observations.stopTimeoutSeconds,
            profileState: observations.profileResult.state,
        }

        // The evidence detail already names the profile state; only a parse
        // failure carries extra information worth forwarding.
        let parseDetail = ""
        if (observations.profileResult.state === "invalid") {
            parseDetail = observations.profileResult.detail
        }

        const request = buildAgentStoppedRequest(evidence, jobStatus, parseDetail)
        const client = new ControlPlaneClient({
            baseURL: resolveControlPlaneBaseURL(),
            agentToken: observations.agentToken,
        })

        await client.reportAgentStopped(request)
        core.info(`control plane: reported agent stop (reason=${request.reason}, profile=${request.profile_state})`)
    } catch (error) {
        core.info(`control plane: agent stop report skipped: ${getErrorMessage(error)}`)
    }
}

/**
 * Resolves the job's status from the GitHub API (best-effort). The signal is
 * only used to classify missing-profile runs more accurately.
 * @returns {Promise<JobStatusResolution>}
 */
async function resolveJobStatus() {
    return resolveJobStatusFromGitHub({
        token: firstNonEmptyString(core.getState("githubToken"), getEnv("GITHUB_TOKEN")),
        repository: getEnv("GITHUB_REPOSITORY"),
        runID: getEnv("GITHUB_RUN_ID"),
        runAttempt: getEnv("GITHUB_RUN_ATTEMPT"),
        runnerName: getEnv("RUNNER_NAME"),
        jobName: getEnv("GITHUB_JOB"),
    })
}

/**
 * @param {AgentStopEvidence} evidence
 * @param {JobStatusResolution} jobStatus
 * @param {string} parseDetail
 * @returns {AgentStoppedRequest}
 */
function buildAgentStoppedRequest(evidence, jobStatus, parseDetail) {
    /** @type {AgentStoppedJibrilFields} */
    const jibril = {
        stop_outcome: evidence.stopOutcome,
        force_stopped: evidence.forceStopped,
    }

    const unitState = evidence.unitStateAfterStop
    if (unitState !== null) {
        jibril.active_state = unitState.activeState
        jibril.result = unitState.result
        jibril.exec_main_status = unitState.execMainStatus
    }

    /** @type {AgentStoppedRequest} */
    const request = {
        reason: classifyAgentStop(evidence),
        profile_state: evidence.profileState,
        detail: joinDetails(formatAgentStopDetail(evidence), parseDetail),
        run_id: getEnv("GITHUB_RUN_ID"),
        jibril,
    }

    const runAttempt = getEnv("GITHUB_RUN_ATTEMPT")
    if (runAttempt !== "") {
        request.run_attempt = runAttempt
    }

    const job = getProfileJobName()
    if (job !== "") {
        request.job = job
    }

    // The source is only meaningful alongside a status, and "unknown" is
    // expressed by omitting both.
    if (jobStatus.status !== "" && jobStatus.source !== "unknown") {
        request.job_status = jobStatus.status
        request.job_status_source = jobStatus.source
    }

    return request
}

/**
 * @param {...string} details
 * @returns {string}
 */
function joinDetails(...details) {
    return details.filter(detail => detail !== "").join("; ")
}

/**
 * Resolves the control-plane envelope ID for this run's profile by listing
 * the profiles recorded for the agent created in the main step. Fail-closed:
 * any missing credential, missing agent, ambiguity, or request failure
 * returns "" and the render keeps its existing linkless behavior.
 * @param {string} agentID
 * @returns {Promise<string>}
 */
async function resolveProfileEnvelopeID(agentID) {
    if (agentID === "") {
        return ""
    }

    const baseURL = resolveControlPlaneBaseURL()
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
 * between steps; the post step performs its own exchange. Fail-closed: missing
 * permission or any exchange failure returns "".
 * @param {string} baseURL
 * @returns {Promise<string>}
 */
async function resolvePostWorkflowToken(baseURL) {
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
 * @returns {string}
 */
function resolveControlPlaneBaseURL() {
    return firstNonEmptyString(getEnv("GARNET_API_URL"), core.getInput("api_url"), "https://api.garnet.ai")
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
        core.info("github: GITHUB_EVENT_PATH is not set, skipping PR comment")
        return
    }

    const repository = getEnv("GITHUB_REPOSITORY")
    if (repository === "") {
        core.warning("github: GITHUB_REPOSITORY is not set, skipping PR comment")
        return
    }

    const token = firstNonEmptyString(core.getState("githubToken"), getEnv("GITHUB_TOKEN"))
    if (token === "") {
        core.warning("github: github_token is not set, skipping PR comment")
        return
    }

    const pullRequestNumber = await getPullRequestNumberFromEvent(eventPath)
    if (pullRequestNumber === null) {
        core.info("github: workflow is not running for a pull request, skipping PR comment")
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
        core.info(`github: PR comment ${result}`)
    } catch (error) {
        if (isCommentPermissionError(error)) {
            core.info(
                "github: PR comment skipped: the workflow token cannot comment on this pull request. " +
                    "The Garnet GitHub App is the supported comment path and needs no workflow permissions: " +
                    "https://github.com/apps/garnet-runtime-review/installations/select_target. " +
                    "To publish from this action instead, grant this workflow `pull-requests: write`.",
            )
            return
        }
        core.warning(`github: failed to publish PR comment: ${formatPullRequestCommentPublishError(error)}`)
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
 * Reads the jibril unit state for diagnostics and stop-reason classification.
 * @returns {Promise<JibrilUnitState | null>}
 */
async function readJibrilUnitState() {
    try {
        const result = await exec.getExecOutput(
            "sudo",
            ["systemctl", "show", "jibril.service", "-p", "ActiveState", "-p", "Result", "-p", "ExecMainStatus"],
            {
                silent: true,
                ignoreReturnCode: true,
            },
        )
        if (result.exitCode !== 0) {
            return null
        }

        const properties = parseSystemctlProperties(result.stdout)
        return {
            activeState: properties.get("ActiveState") ?? "",
            result: properties.get("Result") ?? "",
            execMainStatus: parseExecMainStatus(properties.get("ExecMainStatus")),
        }
    } catch (error) {
        core.info(`could not read jibril service state: ${getErrorMessage(error)}`)
        return null
    }
}

/**
 * @param {string} label
 * @param {JibrilUnitState | null} state
 * @returns {void}
 */
function logJibrilUnitState(label, state) {
    if (state === null) {
        return
    }

    const line = `ActiveState=${state.activeState}, Result=${state.result}, ExecMainStatus=${state.execMainStatus}`
    core.info(`${label}: ${line}`)
}

/**
 * Resolves how long the post step waits for `systemctl stop` to complete.
 * @returns {Promise<number>}
 */
async function resolvePostStopTimeoutSeconds() {
    const fromSettings = resolveStopTimeoutFromSettings({
        envOverride: getEnv(STOP_TIMEOUT_ENV),
        savedState: core.getState("stopTimeoutSeconds"),
    })
    if (fromSettings !== null) {
        return fromSettings
    }

    // Only runs whose saved state predates `stopTimeoutSeconds` pay for this
    // extra `systemctl` round-trip.
    return resolveStopTimeoutFromUnit(await readUnitStopTimeoutSeconds())
}

/**
 * @returns {Promise<void>}
 */
async function forceStopJibril() {
    core.warning("force stopping jibril: the shutdown flush did not finish within the configured bound")
    await exec.exec("sudo", ["systemctl", "kill", "--signal=SIGKILL", "jibril.service"], {
        ignoreReturnCode: true,
    })
    await exec.exec("sudo", ["timeout", "30s", "systemctl", "stop", "jibril.service"], {
        ignoreReturnCode: true,
    })
}

/**
 * @returns {Promise<number | null>}
 */
async function readUnitStopTimeoutSeconds() {
    try {
        const result = await exec.getExecOutput(
            "sudo",
            ["systemctl", "show", "jibril.service", "-p", "TimeoutStopUSec", "--value"],
            {
                silent: true,
                ignoreReturnCode: true,
            },
        )
        if (result.exitCode !== 0) {
            return null
        }

        return parseSystemdTimespanSeconds(result.stdout.trim())
    } catch (error) {
        core.info(`could not read jibril unit stop timeout: ${getErrorMessage(error)}`)
        return null
    }
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
 * @returns {Promise<RootFileStat>}
 */
async function statRootFile(filePath) {
    const result = await exec.getExecOutput("sudo", ["stat", "-c", "%s", filePath], {
        silent: true,
        ignoreReturnCode: true,
    })
    if (result.exitCode !== 0) {
        return { exists: false, size: 0 }
    }

    const size = Number.parseInt(result.stdout.trim(), 10)
    return { exists: true, size: Number.isSafeInteger(size) && size > 0 ? size : 0 }
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

/**
 * Parses the `key=value` lines printed by `systemctl show`.
 * @param {string} output
 * @returns {Map<string, string>}
 */
function parseSystemctlProperties(output) {
    /** @type {Map<string, string>} */
    const properties = new Map()

    for (const line of output.split("\n")) {
        const separatorIndex = line.indexOf("=")
        if (separatorIndex === -1) {
            continue
        }
        properties.set(line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim())
    }

    return properties
}

/**
 * @param {string | undefined} value
 * @returns {number}
 */
function parseExecMainStatus(value) {
    const parsedValue = Number.parseInt(value ?? "", 10)
    return Number.isSafeInteger(parsedValue) ? parsedValue : 0
}

run()
