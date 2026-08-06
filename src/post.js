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
} from "./shared.js"
import { getPullRequestNumberFromEvent } from "./github-event.js"
import { uploadJibrilArtifacts } from "./post-artifacts.js"
import { getDefaultJsonProfileFile, parseProfileJson, resolveAppBaseURL } from "./profile-comment.js"
import { renderNoRecordSummary, renderStepSummary } from "./runtime-review.js"
import { publishPullRequestComment } from "./pr-comment.js"

/** @typedef {import("./runtime-review.js").JobRecord} JobRecord */

/**
 * @typedef {{
 *   statusCode?: number
 *   apiCode?: string
 * }} GitHubApiErrorDetails
 */

const JSON_PROFILE_LABEL = "JSON profile"

// This is the post step for the action. It is called by the GitHub Actions
// runtime. It stops the Jibril service so the daemon flushes all pending
// events and writes the JSON profile before we read it. It then writes the
// Garnet Execution Summary to the job's Step Summary and publishes the
// fallback PR comment from the same record.

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

        const profile = await readJobRecord(debug === "true")

        await appendExecutionSummary(profile)
        if (profile !== null) {
            await publishProfilerComment(profile)
        }
    } catch (err) {
        // Never fail the job because of the reporting step.
        core.warning(`failed to write execution summary: ${getErrorMessage(err)}`)
    }
}

/**
 * Reads and parses the JSON profile produced by Jibril, or null when the
 * profile is missing or unreadable.
 * @param {boolean} debug
 * @returns {Promise<JobRecord | null>}
 */
async function readJobRecord(debug) {
    const jsonProfilerFile = firstNonEmptyString(core.getState("jsonProfilerFile"), getDefaultJsonProfileFile())

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

        return parseProfileJson(jsonProfile)
    } catch (error) {
        core.warning(`failed to read ${JSON_PROFILE_LABEL}: ${getErrorMessage(error)}`)
        return null
    }
}

/**
 * Writes the full-detail Garnet Execution Summary to the GitHub Step
 * Summary (the evidence register: every chain, PID-distinct, no folds, no
 * markers).
 * @param {JobRecord | null} profile
 * @returns {Promise<void>}
 */
async function appendExecutionSummary(profile) {
    const summaryFile = getEnv("GITHUB_STEP_SUMMARY")
    if (summaryFile === "") {
        core.warning("GITHUB_STEP_SUMMARY is not set, cannot write summary")
        return
    }

    let content
    if (profile === null) {
        content = renderNoRecordSummary()
    } else {
        content = renderStepSummary([profile], { appURL: resolveAppBaseURL() })
    }

    await fs.appendFile(summaryFile, `\n${content}\n`)
    core.info("execution summary written to job summary")
}

/**
 * @param {JobRecord} profile
 * @returns {Promise<void>}
 */
async function publishProfilerComment(profile) {
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
        })
        core.info(`PR comment ${result}`)
    } catch (error) {
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

    if (details.statusCode === 403 && getErrorMessage(error).includes("Resource not accessible by integration")) {
        messageParts.push(
            "hint=The token cannot comment on this PR. Ensure `permissions` include `pull-requests: write` (or `issues: write`) and note that fork PR workflows may still run with read-only tokens.",
        )
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
