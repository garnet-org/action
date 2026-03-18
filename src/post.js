import * as core from "@actions/core"
import * as exec from "@actions/exec"
import * as fs from "node:fs/promises"
import { getEnv, getErrorMessage, pathExists } from "./shared.js"
import { getPullRequestNumberFromEvent } from "./github-event.js"
import { uploadJibrilArtifacts } from "./post-artifacts.js"
import {
  getDefaultJsonProfileFile,
  parseProfileJson,
} from "./profile-comment.js"
import { publishPullRequestComment } from "./pr-comment.js"

/** @typedef {import("./profile-comment.js").NormalizedProfile} NormalizedProfile */

const DEFAULT_PROFILER_FILE = "/var/log/jibril.profiler.out"
const DEFAULT_PROFILER4FUN_FILE = "/var/log/jibril.profiler4fun.out"
const JSON_PROFILE_LABEL = "JSON profile"

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

  const summaryFile = getEnv("GITHUB_STEP_SUMMARY")
  if (summaryFile === "") {
    core.warning("GITHUB_STEP_SUMMARY is not set, cannot write summary")
    return
  }

  await fs.appendFile(summaryFile, `\n${content}\n`)
  core.info("profiler markdown written to job summary")
}

async function publishProfilerComment() {
  const debug = core.getState("debug")
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

  const token = firstNonEmptyString([
    core.getState("githubToken"),
    getEnv("GITHUB_TOKEN"),
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

    if (debug === "true") {
      core.info(`${JSON_PROFILE_LABEL} contents:`)
      core.info(jsonProfile)
    }

    profile = parseProfileJson(jsonProfile)
  } catch (error) {
    core.warning(
      `failed to read ${JSON_PROFILE_LABEL}: ${getErrorMessage(error)}`,
    )
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
    core.warning(`failed to publish PR comment: ${getErrorMessage(error)}`)
  }
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
      getEnv("JIBRIL_PROFILER4FUN_FILE"),
      DEFAULT_PROFILER4FUN_FILE,
    ])
  }

  return firstNonEmptyString([
    core.getState("selectedProfilerFile"),
    core.getState("profilerFile"),
    getEnv("JIBRIL_PROFILER_FILE"),
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
