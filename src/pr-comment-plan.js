import { mergeCommentState, mergeCommentStates, parseCommentState, renderCommentBody } from "./profile-comment.js"
import { CONTROL_PLANE_MARKERS } from "./runtime-review.js"

/**
 * @typedef {import("./runtime-review.js").JobRecord} JobRecord
 */

/**
 * @typedef {{ id: number, body: string }} PullRequestComment
 */

/**
 * @typedef {{
 *   kind: "create"
 *   body: string
 *   duplicateCommentIDs: number[]
 * } | {
 *   kind: "update"
 *   comment: PullRequestComment
 *   body: string
 *   duplicateCommentIDs: number[]
 * } | {
 *   kind: "stale"
 * } | {
 *   kind: "blocked-by-control-plane"
 * }} PublishCommentPlan
 */

/**
 * @typedef {import("./profile-comment.js").RenderOptions} RenderOptions
 */

/**
 * @param {PullRequestComment[]} comments
 * @param {JobRecord} profile
 * @param {number} runAttempt
 * @param {RenderOptions} [renderOptions]
 * @returns {PublishCommentPlan}
 */
export function planPullRequestComment(comments, profile, runAttempt, renderOptions = {}) {
    if (containsControlPlaneComment(comments)) {
        return {
            kind: "blocked-by-control-plane",
        }
    }

    const threadKey = getProfileThreadKey(profile)
    const matchingComments = getManagedCommentsForThread(comments, threadKey)
    const primary = matchingComments.at(-1) ?? null
    const existingState = mergeCommentStates(matchingComments.map(entry => entry.state))
    const mergeResult = mergeCommentState(existingState, profile, runAttempt)

    if (mergeResult.kind === "stale") {
        return { kind: "stale" }
    }

    const duplicateCommentIDs = matchingComments.slice(0, -1).map(entry => entry.comment.id)
    // The explainer and job folds render open on a first-profile comment and
    // collapse on later updates.
    const body = renderCommentBody(mergeResult.state, {
        ...renderOptions,
        explainerOpen: renderOptions.explainerOpen ?? primary === null,
    })

    if (primary === null) {
        return {
            kind: "create",
            body,
            duplicateCommentIDs,
        }
    }

    return {
        kind: "update",
        comment: primary.comment,
        body,
        duplicateCommentIDs,
    }
}

/**
 * @param {PullRequestComment[]} comments
 * @param {string} threadKey
 * @returns {{ comment: PullRequestComment, state: import("./profile-comment.js").CommentState }[]}
 */
function getManagedCommentsForThread(comments, threadKey) {
    return comments
        .map(comment => {
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
 * @param {JobRecord} profile
 * @returns {string}
 */
function getProfileThreadKey(profile) {
    if (profile.sha === "") {
        throw new Error("profile JSON is missing the GitHub commit sha")
    }

    return profile.sha
}

/**
 * @param {import("./profile-comment.js").CommentState} state
 * @param {string} threadKey
 * @returns {boolean}
 */
function isMatchingThread(state, threadKey) {
    const firstJob = state.jobs[0]
    if (firstJob === undefined || firstJob.sha !== threadKey) {
        return false
    }

    return state.jobs.every(job => job.sha === threadKey)
}

/**
 * @template T
 * @param {T | null | undefined} value
 * @returns {value is T}
 */
function isPresent(value) {
    return value !== null && value !== undefined
}

/**
 * @param {PullRequestComment[]} comments
 * @returns {boolean}
 */
function containsControlPlaneComment(comments) {
    return CONTROL_PLANE_MARKERS.some(/** @param {string} marker */ marker =>
        comments.some(comment => comment.body.includes(marker)),
    )
}
