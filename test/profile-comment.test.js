/**
 * Integration gate: the action's PR-comment path (parseProfileJson →
 * mergeCommentState → renderCommentBody) renders the Runtime Review
 * byte-identically to the reference path, keeps the action's state-marker
 * machinery intact, and stands down to control-plane comments on both the
 * create and the update paths.
 */
import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import {
    parseProfileJson,
    parseCommentState,
    mergeCommentState,
    renderCommentBody,
    ACTION_COMMENT_MARKER,
    COMMIT_MARKER_PREFIX,
} from "../src/profile-comment.js"
import { planPullRequestComment } from "../src/pr-comment-plan.js"
import {
    buildRunReview,
    renderRunReview,
    summarizeProfile,
    COMMENT_MARKER,
    RUNTIME_REVIEW_MARKER,
    CONTROL_PLANE_MARKERS,
} from "../src/runtime-review.js"
import { publishPullRequestCommentWithClient } from "../src/pr-comment.js"

const here = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(here, "fixtures")

const RENDERED_AT = "2026-07-03T14:02:00Z"
const CAPABILITY_LINK = "https://app.garnet.ai/p/runtime-review-testbed"
const RENDER_OPTIONS = { permalinkUrl: CAPABILITY_LINK, renderedAt: RENDERED_AT }

async function loadProfileJson(name) {
    const raw = JSON.parse(await readFile(join(fixturesDir, "profiles", name), "utf8"))
    // The captured testbed profiles predate the timestamp field.
    return JSON.stringify({ timestamp: RENDERED_AT, ...raw })
}

function stateFor(profile) {
    const merged = mergeCommentState(null, profile, 1)
    assert.equal(merged.kind, "updated")
    return merged.state
}

const worth = parseProfileJson(await loadProfileJson("worth-a-look-run.json"))
const body = renderCommentBody(stateFor(worth), RENDER_OPTIONS)

test("comment body: runtime-review marker first, then the action's state markers", () => {
    const lines = body.split("\n")
    assert.equal(lines[0], RUNTIME_REVIEW_MARKER)
    assert.equal(lines[1], COMMENT_MARKER)
    assert.equal(lines[2], `<!-- ${ACTION_COMMENT_MARKER} -->`)
    assert.ok(lines[3].startsWith(`<!-- ${COMMIT_MARKER_PREFIX}${worth.github.sha}`))
    assert.ok(lines[4].startsWith("<!-- garnet-action-comment-state:"))
})

test("comment body: state marker round-trips through parseCommentState", () => {
    const state = parseCommentState(body)
    assert.ok(state !== null)
    assert.equal(state.version, 2)
    assert.equal(state.profiles.length, 1)
    assert.equal(state.profiles[0].github.run_id, worth.github.run_id)
})

test("comment body renders byte-identically to the reference render path", async () => {
    const raw = JSON.parse(await readFile(join(fixturesDir, "profiles", "worth-a-look-run.json"), "utf8"))
    const job = summarizeProfile(raw)
    const reference = renderRunReview(
        buildRunReview({
            repo: "garnet-labs/runtime-review-testbed",
            sha: job.sha,
            commitUrl: `https://github.com/garnet-labs/runtime-review-testbed/commit/${job.sha}`,
            permalink: CAPABILITY_LINK,
            docsUrl: "https://github.com/garnet-org/action#readme",
            renderedAt: RENDERED_AT,
            jobs: [job],
        }),
    )
    const markerPrefix = `${RUNTIME_REVIEW_MARKER}\n${COMMENT_MARKER}\n`
    assert.ok(reference.startsWith(markerPrefix))
    const content = body.split("\n").slice(5).join("\n")
    assert.equal(content, reference.slice(markerPrefix.length))
})

test("stand-down: control-plane comment blocks the CREATE path", () => {
    const comments = [{ id: 1, body: `<!-- ${CONTROL_PLANE_MARKERS[0]} -->\nCP comment` }]
    const plan = planPullRequestComment(comments, worth, 1, RENDER_OPTIONS)
    assert.equal(plan.kind, "blocked-by-control-plane")
})

test("stand-down: control-plane comment blocks the UPDATE path too", () => {
    const comments = [
        { id: 1, body },
        { id: 2, body: `<!-- ${CONTROL_PLANE_MARKERS[1]} -->\nCP pending comment` },
    ]
    const plan = planPullRequestComment(comments, worth, 2, RENDER_OPTIONS)
    assert.equal(plan.kind, "blocked-by-control-plane")
})

test("no control-plane comment: update path proceeds normally", () => {
    const plan = planPullRequestComment([{ id: 1, body }], worth, 2, RENDER_OPTIONS)
    assert.equal(plan.kind, "update")
})

test("publishPullRequestCommentWithClient leaves takeover comments alone when control-plane takes over", async () => {
    const calls = { listComments: 0, createBody: null, createId: 0, deletedIds: [] }
    const client = {
        async listComments() {
            calls.listComments += 1
            if (calls.listComments < 3) {
                return []
            }

            return [
                { id: 100, body: `<!-- ${CONTROL_PLANE_MARKERS[0]} -->\nCP comment` },
            ]
        },
        async createComment(body) {
            calls.createBody = body
            calls.createId = 321
            return { id: calls.createId, body }
        },
        async updateComment() {
            throw new Error("updateComment should not be called")
        },
        async deleteComment(commentId) {
            calls.deletedIds.push(commentId)
        },
    }

    const result = await publishPullRequestCommentWithClient(client, worth, 1, {
        wait: async () => {},
        renderOptions: RENDER_OPTIONS,
    })

    assert.equal(result, "skipped-control-plane")
    assert.ok(calls.createBody !== null)
    assert.deepEqual(calls.deletedIds, [])
    assert.equal(calls.listComments, 3)
})
