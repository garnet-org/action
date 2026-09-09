import * as github from "@actions/github"
import { isRecord } from "./shared.js"

/**
 * A PR comment as the planner sees it. `author` is the commenter's login
 * and `authorType` the GitHub account type (`Bot`, `User`, ...); both are
 * empty when the API omits them, which the planner treats as untrusted.
 * @typedef {{
 *   id: number
 *   body: string
 *   author: string
 *   authorType: string
 * }} PullRequestComment
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
   * @returns {Promise<PullRequestComment>}
   */
  async createComment(body) {
    const response = await this.octokit.rest.issues.createComment({
      ...this.repo,
      issue_number: this.pullRequestNumber,
      body,
    })

    const comment = normalizeComment(response.data)
    if (comment === null) {
      throw new Error(
        "GitHub createComment response did not include a valid comment",
      )
    }

    return comment
  }

  /**
   * @param {number} commentID
   * @param {string} body
   * @returns {Promise<void>}
   */
  async updateComment(commentID, body) {
    await this.octokit.rest.issues.updateComment({
      ...this.repo,
      comment_id: commentID,
      body,
    })
  }

  /**
   * @param {number} commentID
   * @returns {Promise<void>}
   */
  async deleteComment(commentID) {
    await this.octokit.rest.issues.deleteComment({
      ...this.repo,
      comment_id: commentID,
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

  if (typeof value.id !== "number" || typeof value.body !== "string") {
    return null
  }

  const user = isRecord(value.user) ? value.user : null
  const author = user !== null && typeof user.login === "string" ? user.login : ""
  const authorType = user !== null && typeof user.type === "string" ? user.type : ""

  return { id: value.id, body: value.body, author, authorType }
}

/**
 * @template T
 * @param {T | null | undefined} value
 * @returns {value is T}
 */
function isPresent(value) {
  return value !== null && value !== undefined
}
