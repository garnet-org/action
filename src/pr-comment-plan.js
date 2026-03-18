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
 * @param {PullRequestComment[]} comments
 * @param {NormalizedProfile} profile
 * @param {number} runAttempt
 * @returns {PublishCommentPlan}
 */
export function planPullRequestComment(comments, profile, runAttempt) {
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
 * @param {PullRequestComment[]} comments
 * @param {string} threadKey
 * @returns {{ comment: PullRequestComment, state: import("./profile-comment.js").CommentState }[]}
 */
function getManagedCommentsForThread(comments, threadKey) {
  return comments
    .filter((comment) => comment.body.includes(COMMENT_MARKER))
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
 * @template T
 * @param {T | null | undefined} value
 * @returns {value is T}
 */
function isPresent(value) {
  return value !== null && value !== undefined
}
