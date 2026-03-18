import * as github from "@actions/github"
import { isRecord } from "./shared.js"

/**
 * @typedef {{ id: number, body: string }} PullRequestComment
 */

export class GitHubIssueCommentClient {
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

    return comments.map((value) => normalizeComment(value)).filter(isPresent)
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
 * @template T
 * @param {T | null | undefined} value
 * @returns {value is T}
 */
function isPresent(value) {
  return value !== null && value !== undefined
}
