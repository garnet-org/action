import * as core from "@actions/core"
import * as exec from "@actions/exec"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { default as artifactClient } from "@actions/artifact"
import { redactString } from "./redact.js"
import { getEnv, getErrorMessage } from "./shared.js"

const DEBUG_ARTIFACT_NAME = "jibril-debug-logs"
const DEFAULT_RUN_ATTEMPT = "1"
/** @type {[string, string][]} */
const JIBRIL_LOG_FILES = [
    ["/var/log/jibril.log", "jibril.log"],
    ["/var/log/jibril.err", "jibril.err"],
    ["/var/log/jibril.out", "jibril.out"],
]

export async function uploadJibrilArtifacts() {
    /** @type {string} */
    let artifactDir
    try {
        artifactDir = await fs.mkdtemp(path.join(os.tmpdir(), "garnet-"))
    } catch (err) {
        core.warning(`Failed to create a staging directory for jibril artifacts: ${getErrorMessage(err)}`)
        return
    }

    try {
        const staged = await stageRedactedLogFiles(artifactDir)
        if (staged.length === 0) {
            core.info("No jibril log files to upload")
            return
        }

        const absolutePaths = staged.map(fileName => path.resolve(artifactDir, fileName))

        await artifactClient.uploadArtifact(getDebugArtifactName(), absolutePaths, artifactDir)
        core.info(`Uploaded jibril artifacts: ${staged.join(", ")}`)
    } catch (err) {
        const msg = getErrorMessage(err)
        if (isArtifactAuthErrorMessage(msg)) {
            core.warning(`Jibril artifact upload skipped (auth unavailable): ${msg}`)
        } else {
            core.warning(`Failed to upload jibril artifacts: ${msg}`)
        }
    } finally {
        await fs.rm(artifactDir, { recursive: true, force: true })
    }
}

/**
 * @param {string} artifactDir
 * @returns {Promise<string[]>}
 */
async function stageRedactedLogFiles(artifactDir) {
    /** @type {string[]} */
    const staged = []

    for (const [src, destName] of JIBRIL_LOG_FILES) {
        if (await stageRedactedLogFile(artifactDir, src, destName)) {
            staged.push(destName)
        }
    }

    return staged
}

/**
 * @param {string} artifactDir
 * @param {string} src
 * @param {string} destName
 * @returns {Promise<boolean>}
 */
async function stageRedactedLogFile(artifactDir, src, destName) {
    try {
        const catResult = await exec.getExecOutput("sudo", ["cat", src], {
            ignoreReturnCode: true,
            silent: true,
        })
        if (catResult.exitCode !== 0) {
            core.debug(`Skipping ${destName}: source may not exist (cat exit ${catResult.exitCode})`)
            return false
        }

        const destPath = path.join(artifactDir, destName)
        await fs.writeFile(destPath, redactString(catResult.stdout), "utf8")
        return true
    } catch {
        return false
    }
}

/**
 * @returns {string}
 */
function getDebugArtifactName() {
    const jobName = getEnv("GITHUB_JOB")
    const runAttempt = getEnv("GITHUB_RUN_ATTEMPT")

    const artifactNameParts = [DEBUG_ARTIFACT_NAME]
    if (jobName !== "") {
        artifactNameParts.push(sanitizeArtifactNamePart(jobName))
    }

    const parsedRunAttempt = parseRunAttempt(runAttempt === "" ? DEFAULT_RUN_ATTEMPT : runAttempt)
    artifactNameParts.push(`attempt-${parsedRunAttempt}`)

    return artifactNameParts.join("-")
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
 * @param {string} value
 * @returns {string}
 */
function sanitizeArtifactNamePart(value) {
    return value.replace(/[^A-Za-z0-9._-]+/g, "-")
}

/**
 * @param {string} message
 * @returns {boolean}
 */
function isArtifactAuthErrorMessage(message) {
    return message.includes("ACTIONS_RUNTIME_TOKEN") || message.includes("AUTH_TOKEN") || message.includes("token")
}
