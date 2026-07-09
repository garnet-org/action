import * as core from "@actions/core"
import * as exec from "@actions/exec"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import { getEnv, getErrorMessage, isSupportedArch, isSupportedPlatform, pathExists } from "./shared.js"
import { getPullRequestNumberFromEvent } from "./github-event.js"
import { uploadJibrilArtifacts } from "./post-artifacts.js"
import { getDefaultJsonProfileFile, parseProfileJson, resolveAppBaseUrl } from "./profile-comment.js"
import { renderNoRecord, renderStepSummary } from "./runtime-review.js"
import { publishPullRequestComment } from "./pr-comment.js"

/** @typedef {import("./profile-comment.js").NormalizedProfile} NormalizedProfile */
/** @typedef {import("./profile-comment.js").RenderOptions} RenderOptions */

/**
 * @typedef {{ normalized: NormalizedProfile, raw: unknown }} LoadedProfile
 */

const JSON_PROFILE_LABEL = "JSON profile"
const DOCS_URL = "https://github.com/garnet-org/action#readme"

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

        // Stop the Jibril service so the daemon flushes all pending events.
        core.info("stopping jibril service")
        await exec.exec("sudo", ["systemctl", "stop", "jibril.service"], {
            ignoreReturnCode: true,
        })

        // Upload jibril logs as artifacts when debug is enabled (only after service stops).
        // Get the debug state from the main.js.
        const debug = core.getState("debug")
        if (debug === "true") {
            await uploadJibrilArtifacts()
        }

        const profile = await readProfile(debug === "true")
        const renderOptions = getRenderOptions()

        await appendRuntimeReviewSummary(profile, renderOptions)
        if (profile !== null) {
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
 * @param {boolean} debug
 * @returns {Promise<LoadedProfile | null>}
 */
async function readProfile(debug) {
    const jsonProfilerFile = firstNonEmptyString([core.getState("jsonProfilerFile"), getDefaultJsonProfileFile()])

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
        content = renderNoRecord({
            sha,
            commitUrl: repository !== "" && sha !== "" ? `https://github.com/${repository}/commit/${sha}` : "",
            expectedJobs: renderOptions.expectedJobs ?? 1,
            docsUrl: DOCS_URL,
            renderedAt: renderOptions.renderedAt ?? new Date(),
            firstRun: false,
        })
    } else {
        const preview = core.getState("preview") === "true"
        content = renderStepSummary([profile.raw], { appUrl: resolveAppBaseUrl(), preview })
    }

    await fs.appendFile(summaryFile, `\n${content}\n`)
    core.info("Garnet Runtime Summary written to job summary")
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

    const token = firstNonEmptyString([core.getState("githubToken"), getEnv("GITHUB_TOKEN")])
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
        core.warning(`failed to publish PR comment: ${getErrorMessage(error)}`)
    }
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
 * @param {string[]} values
 * @returns {string}
 */
function firstNonEmptyString(values) {
    for (const value of values) {
        if (value !== "") {
            return value
        }
    }

    return ""
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
