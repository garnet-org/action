import { getPullRequestNumberFromEvent } from "./github-event.js"
import { GitHubIssueCommentClient } from "./github-issue-comment-client.js"
import { planPullRequestComment } from "./pr-comment-plan.js"

/**
 * @typedef {import("./profile-comment.js").NormalizedProfile} NormalizedProfile
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
 * @param {{ deleteComment(commentId: number): Promise<void> }} client
 * @param {number[]} commentIds
 * @returns {Promise<void>}
 */
async function deleteComments(client, commentIds) {
  for (const commentId of commentIds) {
    await client.deleteComment(commentId)
  }
}
