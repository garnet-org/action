import * as core from "@actions/core"
import * as exec from "@actions/exec"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import { default as artifactClient } from "@actions/artifact"
import {
  getDefaultJsonProfileFile,
  parseProfileJson,
} from "./profile-comment.js"
import {
  getPullRequestNumberFromEvent,
  publishPullRequestComment,
} from "./pr-comment.js"

/** @typedef {import("./profile-comment.js").NormalizedProfile} NormalizedProfile */

const DEFAULT_PROFILER_FILE = "/var/log/jibril.profiler.out"
const DEFAULT_PROFILER4FUN_FILE = "/var/log/jibril.profiler4fun.out"
const DEBUG_ARTIFACT_NAME = "jibril-debug-logs"
const JSON_PROFILE_LABEL = "JSON profile"
const DEFAULT_RUN_ATTEMPT = "1"
/** @type {[string, string][]} */
const JIBRIL_LOG_FILES = [
  ["/var/log/jibril.log", "jibril.log"],
  ["/var/log/jibril.err", "jibril.err"],
  ["/var/log/jibril.out", "jibril.out"],
]

// This is the post step for the action. It is called by the GitHub Actions
// runtime. It stops the Jibril service so the daemon flushes all pending events
// and writes the profiler markdown before we read it. It then reads the profiler
// markdown and appends it to the real GITHUB_STEP_SUMMARY.

async function run() {
  try {
    // Stop the Jibril service so the daemon flushes all pending events.
    core.info("stopping jibril service")
    await exec.exec("sudo", ["systemctl", "stop", "jibril.service"], {
      ignoreReturnCode: true,
    })

    // Remove secrets from disk (best-effort). Important for self-hosted runners.
    await exec.exec("sudo", ["rm", "-f", "/etc/default/jibril"], {
      ignoreReturnCode: true,
    })

    // Upload jibril logs as artifacts when debug is enabled (only after service stops).
    // Get the debug state from the main.js.
    const debug = core.getState("debug")
    if (debug === "true") {
      await uploadJibrilArtifacts()
    }

    const selectedProfiler = resolveSelectedProfiler()
    const profilerFile = resolveSelectedProfilerFile(selectedProfiler)

    core.info(`using profiler printer: ${selectedProfiler}`)

    await appendProfilerSummary(profilerFile)
    await publishProfilerComment()
  } catch (err) {
    // Never fail the job because of the profiler step.
    core.warning(`failed to write summary: ${getErrorMessage(err)}`)
  }
}

/**
 * @param {string} profilerFile
 * @returns {Promise<void>}
 */
async function appendProfilerSummary(profilerFile) {
  const content = await readRootFile(profilerFile, "summary")
  if (content === "") {
    return
  }

  const summaryFile = getEnvString("GITHUB_STEP_SUMMARY")
  if (summaryFile === "") {
    core.warning("GITHUB_STEP_SUMMARY is not set, cannot write summary")
    return
  }

  await fs.appendFile(summaryFile, `\n${content}\n`)
  core.info("profiler markdown written to job summary")
}

async function publishProfilerComment() {
  const eventPath = getEnvString("GITHUB_EVENT_PATH")
  if (eventPath === "") {
    core.info("GITHUB_EVENT_PATH is not set, skipping PR comment")
    return
  }

  const repository = getEnvString("GITHUB_REPOSITORY")
  if (repository === "") {
    core.warning("GITHUB_REPOSITORY is not set, skipping PR comment")
    return
  }

  const token = firstNonEmptyString([
    core.getState("githubToken"),
    getEnvString("GITHUB_TOKEN"),
  ])
  if (token === "") {
    core.warning("github_token is not set, skipping PR comment")
    return
  }

  const pullRequestNumber = await getPullRequestNumberFromEvent(eventPath)
  if (pullRequestNumber === null) {
    core.info("workflow is not running for a pull request, skipping PR comment")
    return
  }

  const jsonProfilerFile = firstNonEmptyString([
    core.getState("jsonProfilerFile"),
    getDefaultJsonProfileFile(),
  ])
  /** @type {NormalizedProfile} */
  let profile
  try {
    const jsonProfile = await readOptionalRootFile(jsonProfilerFile)
    if (jsonProfile === "") {
      core.info(
        `JSON profile not found, skipping PR comment: ${jsonProfilerFile}`,
      )
      return
    }
    profile = parseProfileJson(jsonProfile)
  } catch (error) {
    core.warning(
      `failed to read ${JSON_PROFILE_LABEL}: ${getErrorMessage(error)}`,
    )
    return
  }

  const runAttempt = parseRunAttempt(getEnvString("GITHUB_RUN_ATTEMPT"))

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
    core.warning(`failed to publish PR comment: ${getErrorMessage(error)}`)
  }
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function getErrorMessage(err) {
  if (err instanceof Error) {
    return err.message
  }

  return String(err)
}

/**
 * @param {string} filePath
 * @param {string} label
 * @returns {Promise<string>}
 */
async function readRootFile(filePath, label) {
  if (filePath === "") {
    core.warning(`${label} file path is not set, skipping`)
    return ""
  }

  try {
    const content = await readRootFileContent(filePath)
    if (content === "") {
      core.warning(`${label} file not found or unreadable: ${filePath}`)
      return ""
    }
    return content
  } catch (error) {
    core.warning(`failed to read ${label} file: ${getErrorMessage(error)}`)
    return ""
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

async function uploadJibrilArtifacts() {
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
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * @returns {"profiler" | "profiler4fun"}
 */
function resolveSelectedProfiler() {
  const selectedProfiler = core.getState("selectedProfiler")
  if (selectedProfiler === "profiler" || selectedProfiler === "profiler4fun") {
    return selectedProfiler
  }

  return core.getState("profiler4fun") === "true" ? "profiler4fun" : "profiler"
}

/**
 * @param {"profiler" | "profiler4fun"} selectedProfiler
 * @returns {string}
 */
function resolveSelectedProfilerFile(selectedProfiler) {
  if (selectedProfiler === "profiler4fun") {
    return firstNonEmptyString([
      core.getState("selectedProfilerFile"),
      core.getState("profiler4funFile"),
      getEnvString("JIBRIL_PROFILER4FUN_FILE"),
      DEFAULT_PROFILER4FUN_FILE,
    ])
  }

  return firstNonEmptyString([
    core.getState("selectedProfilerFile"),
    core.getState("profilerFile"),
    getEnvString("JIBRIL_PROFILER_FILE"),
    DEFAULT_PROFILER_FILE,
  ])
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
 * @param {string} name
 * @returns {string}
 */
function getEnvString(name) {
  const value = process.env[name]
  return typeof value === "string" ? value : ""
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
 * @returns {string}
 */
function getDebugArtifactName() {
  const jobName = getEnvString("GITHUB_JOB")
  const runAttempt = getEnvString("GITHUB_RUN_ATTEMPT")

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
 * @returns {string}
 */
function sanitizeArtifactNamePart(value) {
  return value.replace(/[^A-Za-z0-9._-]+/g, "-")
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

run()
