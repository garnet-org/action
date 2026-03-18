import * as fs from "node:fs/promises"
import * as github from "@actions/github"
import {
  COMMENT_MARKER,
  mergeCommentState,
  mergeCommentStates,
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
 *   kind: "create"
 *   body: string
 *   duplicateCommentIds: number[]
 * } | {
 *   kind: "update"
 *   comment: PullRequestComment
 *   body: string
 *   duplicateCommentIds: number[]
 * } | {
 *   kind: "stale"
 * }} PublishCommentPlan
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

  const plan = planPullRequestComment(
    await client.listComments(),
    options.profile,
    options.runAttempt,
  )

  if (plan.kind === "stale") {
    return "skipped-stale"
  }

  if (plan.kind === "create") {
    await client.createComment(plan.body)
    return "created"
  }

  if (plan.comment.body !== plan.body) {
    await client.updateComment(plan.comment.id, plan.body)
  }
  await deleteComments(client, plan.duplicateCommentIds)
  return "updated"
}

/**
 * @param {PullRequestComment[]} comments
 * @param {NormalizedProfile} profile
 * @param {number} runAttempt
 * @returns {PublishCommentPlan}
 */
function planPullRequestComment(comments, profile, runAttempt) {
  const threadKey = getProfileThreadKey(profile)
  const matchingComments = getManagedCommentsForThread(comments, threadKey)
  const primary = matchingComments.at(-1) ?? null
  const existingState = mergeCommentStates(
    matchingComments.map((entry) => entry.state),
  )
  const mergeResult = mergeCommentState(existingState, profile, runAttempt)

  if (mergeResult.kind === "stale") {
    return { kind: "stale" }
  }

  const duplicateCommentIds = matchingComments
    .slice(0, -1)
    .map((entry) => entry.comment.id)
  const body = renderCommentBody(mergeResult.state)

  if (primary === null) {
    return {
      kind: "create",
      body,
      duplicateCommentIds,
    }
  }

  return {
    kind: "update",
    comment: primary.comment,
    body,
    duplicateCommentIds,
  }
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
 * @param {PullRequestComment[]} comments
 * @param {string} threadKey
 * @returns {{ comment: PullRequestComment, state: import("./profile-comment.js").CommentState }[]}
 */
function getManagedCommentsForThread(comments, threadKey) {
  return comments
    .map((comment) => {
      const state = parseCommentState(comment.body)
      if (state === null) {
        return null
      }

      return isMatchingThread(state, threadKey) ? { comment, state } : null
    })
    .filter(isPresent)
    .toSorted((left, right) => left.comment.id - right.comment.id)
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function getProfileThreadKey(profile) {
  if (profile.github.sha === "") {
    throw new Error("profile JSON is missing the GitHub commit sha")
  }

  return profile.github.sha
}

/**
 * @param {import("./profile-comment.js").CommentState} state
 * @param {string} threadKey
 * @returns {boolean}
 */
function isMatchingThread(state, threadKey) {
  const firstProfile = state.profiles[0]
  if (firstProfile === undefined || firstProfile.github.sha !== threadKey) {
    return false
  }

  return state.profiles.every((profile) => profile.github.sha === threadKey)
}

/**
 * @param {GitHubIssueCommentClient} client
 * @param {number[]} commentIds
 * @returns {Promise<void>}
 */
async function deleteComments(client, commentIds) {
  for (const commentId of commentIds) {
    await client.deleteComment(commentId)
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

/**
 * @template T
 * @param {T | null | undefined} value
 * @returns {value is T}
 */
function isPresent(value) {
  return value !== null && value !== undefined
}
