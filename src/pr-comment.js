import * as fs from "node:fs/promises"
import * as github from "@actions/github"
import {
  COMMENT_MARKER,
  mergeCommentState,
  parseCommentState,
  renderCommentBody,
} from "./profile-comment.js"

/**
 * @typedef {import("./profile-comment.js").NormalizedProfile} NormalizedProfile
 */

/**
 * @typedef {{ id: number, body: string }} PullRequestComment
 */

/**
 * @typedef {{
 *   repository: string
 *   pullRequestNumber: number
 *   token: string
 *   profile: NormalizedProfile
 *   runAttempt: number
 * }} PublishCommentOptions
 */

/**
 * @param {PublishCommentOptions} options
 * @returns {Promise<"created" | "updated" | "skipped-stale">}
 */
export async function publishPullRequestComment(options) {
  const client = new GitHubIssueCommentClient(
    options.repository,
    options.pullRequestNumber,
    options.token,
  )

  const comments = await client.listComments()
  const matchingComments = comments
    .map((comment) => ({
      comment,
      state: parseCommentState(comment.body),
    }))
    .filter((entry) => entry.state !== null)
    .sort((left, right) => left.comment.id - right.comment.id)

  const primary = matchingComments.at(-1) ?? null
  const mergeResult = mergeCommentState(
    primary?.state ?? null,
    options.profile,
    options.runAttempt,
  )

  if (mergeResult.kind === "stale") {
    return "skipped-stale"
  }

  const body = renderCommentBody(mergeResult.state)

  if (primary === null) {
    await client.createComment(body)
    return "created"
  }

  if (primary.comment.body !== body) {
    await client.updateComment(primary.comment.id, body)
  }
  await deleteDuplicateComments(client, matchingComments.slice(0, -1))
  return "updated"
}

/**
 * @param {string} eventPath
 * @returns {Promise<number | null>}
 */
export async function getPullRequestNumberFromEvent(eventPath) {
  const payload = JSON.parse(await fs.readFile(eventPath, "utf8"))
  if (!isRecord(payload)) {
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
 * @param {string} repository
 * @returns {{ owner: string, repo: string }}
 */
function splitRepository(repository) {
  const [owner, repo] = repository.split("/")
  if (owner === undefined || owner === "") {
    throw new Error(`invalid GITHUB_REPOSITORY value: ${repository}`)
  }
  if (repo === undefined || repo === "") {
    throw new Error(`invalid GITHUB_REPOSITORY value: ${repository}`)
  }
  return { owner, repo }
}

class GitHubIssueCommentClient {
  /**
   * @param {string} repository
   * @param {number} pullRequestNumber
   * @param {string} token
   */
  constructor(repository, pullRequestNumber, token) {
    this.repository = repository
    this.pullRequestNumber = pullRequestNumber
    this.octokit = github.getOctokit(token)
  }

  /**
   * @returns {Promise<PullRequestComment[]>}
   */
  async listComments() {
    const comments = await this.octokit.paginate(
      this.octokit.rest.issues.listComments,
      {
        ...this.repo,
        issue_number: this.pullRequestNumber,
        per_page: 100,
      },
    )

    return comments
      .map((value) => normalizeComment(value))
      .filter((value) => value !== null)
      .filter((comment) => comment.body.includes(COMMENT_MARKER))
  }

  /**
   * @param {string} body
   * @returns {Promise<void>}
   */
  async createComment(body) {
    await this.octokit.rest.issues.createComment({
      ...this.repo,
      issue_number: this.pullRequestNumber,
      body,
    })
  }

  /**
   * @param {number} commentId
   * @param {string} body
   * @returns {Promise<void>}
   */
  async updateComment(commentId, body) {
    await this.octokit.rest.issues.updateComment({
      ...this.repo,
      comment_id: commentId,
      body,
    })
  }

  /**
   * @param {number} commentId
   * @returns {Promise<void>}
   */
  async deleteComment(commentId) {
    await this.octokit.rest.issues.deleteComment({
      ...this.repo,
      comment_id: commentId,
    })
  }

  /**
   * @returns {{ owner: string, repo: string }}
   */
  get repo() {
    return splitRepository(this.repository)
  }
}

/**
 * @param {GitHubIssueCommentClient} client
 * @param {{ comment: PullRequestComment }[]} duplicates
 * @returns {Promise<void>}
 */
async function deleteDuplicateComments(client, duplicates) {
  for (const duplicate of duplicates) {
    await client.deleteComment(duplicate.comment.id)
  }
}

/**
 * @param {unknown} value
 * @returns {PullRequestComment | null}
 */
function normalizeComment(value) {
  if (!isRecord(value)) {
    return null
  }

  return typeof value.id === "number" && typeof value.body === "string"
    ? { id: value.id, body: value.body }
    : null
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
function getOptionalRecord(value) {
  return isRecord(value) ? value : null
}
