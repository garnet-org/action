import * as core from "@actions/core"
import * as exec from "@actions/exec"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { default as artifactClient } from "@actions/artifact"
import { getEnv, getErrorMessage, pathExists } from "./shared.js"

const DEBUG_ARTIFACT_NAME = "jibril-debug-logs"
const DEFAULT_RUN_ATTEMPT = "1"
/** @type {[string, string][]} */
const JIBRIL_LOG_FILES = [
  ["/var/log/jibril.log", "jibril.log"],
  ["/var/log/jibril.err", "jibril.err"],
  ["/var/log/jibril.out", "jibril.out"],
]

export async function uploadJibrilArtifacts() {
  const artifactDir = path.join(os.tmpdir(), "garnet-jibril-artifacts")
  await fs.mkdir(artifactDir, { recursive: true })

  try {
    const uploaded = await copyReadableLogFiles(artifactDir)
    if (uploaded.length === 0) {
      core.info("No jibril log files to upload")
      return
    }

    const existing = await findExistingArtifactFiles(artifactDir, uploaded)
    if (existing.length === 0) {
      core.info("No readable jibril log files to upload")
      return
    }

    const absolutePaths = existing.map((fileName) =>
      path.resolve(artifactDir, fileName),
    )

    await artifactClient.uploadArtifact(
      getDebugArtifactName(),
      absolutePaths,
      artifactDir,
    )
    core.info(`Uploaded jibril artifacts: ${existing.join(", ")}`)
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
async function copyReadableLogFiles(artifactDir) {
  /** @type {string[]} */
  const uploaded = []

  for (const [src, destName] of JIBRIL_LOG_FILES) {
    const copied = await copyReadableLogFile(artifactDir, src, destName)
    if (copied) {
      uploaded.push(destName)
    }
  }

  return uploaded
}

/**
 * @param {string} artifactDir
 * @param {string} src
 * @param {string} destName
 * @returns {Promise<boolean>}
 */
async function copyReadableLogFile(artifactDir, src, destName) {
  try {
    const destPath = path.join(artifactDir, destName)
    const cpResult = await exec.getExecOutput("sudo", ["cp", src, destPath], {
      ignoreReturnCode: true,
      silent: true,
    })
    if (cpResult.exitCode !== 0) {
      core.debug(
        `Skipping ${destName}: source may not exist (cp exit ${cpResult.exitCode})`,
      )
      return false
    }

    await exec.exec("sudo", ["chmod", "a+r", destPath], {
      ignoreReturnCode: true,
    })
    return await pathExists(destPath)
  } catch {
    return false
  }
}

/**
 * @param {string} artifactDir
 * @param {string[]} fileNames
 * @returns {Promise<string[]>}
 */
async function findExistingArtifactFiles(artifactDir, fileNames) {
  /** @type {string[]} */
  const existing = []

  for (const fileName of fileNames) {
    if (await pathExists(path.join(artifactDir, fileName))) {
      existing.push(fileName)
    }
  }

  return existing
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

  const parsedRunAttempt = parseRunAttempt(
    runAttempt === "" ? DEFAULT_RUN_ATTEMPT : runAttempt,
  )
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
  return (
    message.includes("ACTIONS_RUNTIME_TOKEN") ||
    message.includes("AUTH_TOKEN") ||
    message.includes("token")
  )
}