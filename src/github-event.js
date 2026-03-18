import * as fs from "node:fs/promises"
import { getOptionalRecord, isRecord } from "./shared.js"

/**
 * @param {string} eventPath
 * @returns {Promise<number | null>}
 */
export async function getPullRequestNumberFromEvent(eventPath) {
  const payload = await readGitHubEventPayload(eventPath)
  if (payload === null) {
    return null
  }

  const pullRequest = getOptionalRecord(payload.pull_request)
  if (pullRequest !== null && typeof pullRequest.number === "number") {
    return pullRequest.number
  }

  const issue = getOptionalRecord(payload.issue)
  if (
    issue !== null &&
    getOptionalRecord(issue.pull_request) !== null &&
    typeof issue.number === "number"
  ) {
    return issue.number
  }

  return null
}

/**
 * @param {string} eventPath
 * @returns {Promise<string | null>}
 */
export async function getPullRequestHeadShaFromEvent(eventPath) {
  try {
    const payload = await readGitHubEventPayload(eventPath)
    if (payload === null) {
      return null
    }

    const pullRequest = getOptionalRecord(payload.pull_request)
    const head = getOptionalRecord(pullRequest?.head)
    return typeof head?.sha === "string" && head.sha !== "" ? head.sha : null
  } catch {
    return null
  }
}

/**
 * @param {string} eventPath
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function readGitHubEventPayload(eventPath) {
  const payload = JSON.parse(await fs.readFile(eventPath, "utf8"))
  return isRecord(payload) ? payload : null
}