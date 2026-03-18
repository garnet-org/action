import { GitHubIssueCommentClient } from "./github-issue-comment-client.js"
import { planPullRequestComment } from "./pr-comment-plan.js"
import { waitForDelay } from "./shared.js"

/**
 * @typedef {import("./profile-comment.js").NormalizedProfile} NormalizedProfile
 */

/**
 * @typedef {import("./github-issue-comment-client.js").PullRequestComment} PullRequestComment
 */

const CREATE_RECHECK_MIN_DELAY_MS = 750
const CREATE_RECHECK_SPREAD_MS = 1500

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
 * @typedef {{
 *   listComments(): Promise<PullRequestComment[]>
 *   createComment(body: string): Promise<PullRequestComment>
 *   updateComment(commentId: number, body: string): Promise<void>
 *   deleteComment(commentId: number): Promise<void>
 * }} PublishCommentClient
 */

/**
 * @typedef {{ wait?: (delayMs: number) => Promise<void> }} PublishWithClientOptions
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

  return publishPullRequestCommentWithClient(
    client,
    options.profile,
    options.runAttempt,
  )
}

/**
 * @param {PublishCommentClient} client
 * @param {NormalizedProfile} profile
 * @param {number} runAttempt
 * @param {PublishWithClientOptions} [options]
 * @returns {Promise<"created" | "updated" | "skipped-stale">}
 */
export async function publishPullRequestCommentWithClient(
  client,
  profile,
  runAttempt,
  options = {},
) {
  const initialPlan = planPullRequestComment(
    await client.listComments(),
    profile,
    runAttempt,
  )

  if (initialPlan.kind !== "create") {
    return applyPublishPlan(client, initialPlan)
  }

  const wait = options.wait ?? waitForDelay
  await wait(getCreateRecheckDelayMs(profile))

  const plan = planPullRequestComment(
    await client.listComments(),
    profile,
    runAttempt,
  )

  if (plan.kind === "create") {
    const createdComment = await client.createComment(plan.body)
    return reconcilePublishedComment(
      client,
      profile,
      runAttempt,
      createdComment.id,
    )
  }

  return applyPublishPlan(client, plan)
}

/**
 * @param {PublishCommentClient} client
 * @param {import("./pr-comment-plan.js").PublishCommentPlan} plan
 * @returns {Promise<"created" | "updated" | "skipped-stale">}
 */
async function applyPublishPlan(client, plan) {
  if (plan.kind === "stale") {
    return "skipped-stale"
  }

  if (plan.kind === "create") {
    await client.createComment(plan.body)
    return "created"
  }

  await applyUpdatePlan(client, plan)
  return "updated"
}

/**
 * @param {PublishCommentClient} client
 * @param {NormalizedProfile} profile
 * @param {number} runAttempt
 * @param {number} createdCommentId
 * @returns {Promise<"created" | "updated" | "skipped-stale">}
 */
async function reconcilePublishedComment(
  client,
  profile,
  runAttempt,
  createdCommentId,
) {
  const plan = planPullRequestComment(
    await client.listComments(),
    profile,
    runAttempt,
  )

  if (plan.kind === "create") {
    return "created"
  }

  if (plan.kind === "stale") {
    return "skipped-stale"
  }

  await applyUpdatePlan(client, plan)
  return plan.comment.id === createdCommentId ? "created" : "updated"
}

/**
 * @param {PublishCommentClient} client
 * @param {{ kind: "update", comment: PullRequestComment, body: string, duplicateCommentIds: number[] }} plan
 * @returns {Promise<void>}
 */
async function applyUpdatePlan(client, plan) {
  if (plan.comment.body !== plan.body) {
    await client.updateComment(plan.comment.id, plan.body)
  }

  await deleteComments(client, plan.duplicateCommentIds)
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

/**
 * @param {NormalizedProfile} profile
 * @returns {number}
 */
function getCreateRecheckDelayMs(profile) {
  const seed = `${profile.github.workflow}\u0000${profile.github.job}`
  let hash = 0

  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }

  return CREATE_RECHECK_MIN_DELAY_MS + (hash % CREATE_RECHECK_SPREAD_MS)
}

