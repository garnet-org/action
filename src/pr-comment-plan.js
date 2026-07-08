import { mergeCommentState, mergeCommentStates, parseCommentState, renderCommentBody } from "./profile-comment.js"
import { CONTROL_PLANE_MARKERS, RUNTIME_REVIEW_MARKER } from "./runtime-review.js"

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
 * } | {
 *   kind: "blocked-by-control-plane"
 * }} PublishCommentPlan
 */

/**
 * @typedef {import("./profile-comment.js").RenderOptions} RenderOptions
 */

/**
 * @param {PullRequestComment[]} comments
 * @param {NormalizedProfile} profile
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

    const duplicateCommentIds = matchingComments.slice(0, -1).map(entry => entry.comment.id)
    const body = renderCommentBody(mergeResult.state, {
        ...renderOptions,
        firstRun: isFirstCommitLifecycle(comments, threadKey),
    })

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
 * The explainer's open state (v6.1 §1.4): open through the PR's ENTIRE
 * first-commit lifecycle, collapsed from the second commit onward. The
 * comment state marker retains the commit sha, so "still on the PR's first
 * commit" means every prior Garnet comment on the PR belongs to the SAME
 * commit as the incoming profile (vacuously true when none exist). A Garnet
 * comment we cannot attribute to a commit (canonical marker but no parseable
 * state) counts as prior history, so the explainer collapses.
 * @param {PullRequestComment[]} comments
 * @param {string} threadKey
 * @returns {boolean}
 */
function isFirstCommitLifecycle(comments, threadKey) {
    return comments.every(comment => {
        const state = parseCommentState(comment.body)
        if (state !== null) {
            return isMatchingThread(state, threadKey)
        }

        return !comment.body.includes(RUNTIME_REVIEW_MARKER)
    })
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

    return state.profiles.every(profile => profile.github.sha === threadKey)
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
