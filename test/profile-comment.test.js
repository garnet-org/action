/**
 * Integration gate: the action's PR-comment path (parseProfileJson →
 * mergeCommentState → renderCommentBody) renders the Runtime Review
 * byte-identically to the reference path, keeps the action's state-marker
 * machinery intact, stands down to control-plane comments on both the
 * create and the update paths (the dedupe contract from PR #78), and drives
 * the explainer's open state through the first-commit lifecycle (v6.1 §1.4).
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
    buildReportLink,
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

test("comment body: runtime-review markers first, then the action's state markers", () => {
    const lines = body.split("\n")
    assert.equal(lines[0], RUNTIME_REVIEW_MARKER)
    assert.equal(lines[1], COMMENT_MARKER)
    assert.equal(lines[2], `<!-- garnet:commit ${worth.github.sha} -->`)
    assert.equal(lines[3], `<!-- ${ACTION_COMMENT_MARKER} -->`)
    assert.ok(lines[4].startsWith(`<!-- ${COMMIT_MARKER_PREFIX}${worth.github.sha}`))
    assert.ok(lines[5].startsWith("<!-- garnet-action-comment-state:"))
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
            appUrl: "https://app.garnet.ai",
            docsUrl: "https://github.com/garnet-org/action#readme",
            renderedAt: RENDERED_AT,
            jobs: [job],
        }),
    )
    const markerPrefix = `${RUNTIME_REVIEW_MARKER}\n${COMMENT_MARKER}\n<!-- garnet:commit ${job.sha} -->\n`
    assert.ok(reference.startsWith(markerPrefix))
    const content = body.split("\n").slice(6).join("\n")
    assert.equal(content, reference.slice(markerPrefix.length))
})

test("comment body carries the v6.2 anatomy: ### heading, headline, quoted provenance, explainer, canonical tree", () => {
    assert.ok(body.includes("### Garnet Runtime Review"))
    assert.ok(body.includes("**See what ran** — every process your jobs executed, and where they connected"))
    assert.match(body, /> <sub>\*commit \[`[0-9a-f]{7}`\]/)
    assert.ok(body.includes("💡 how to read this"))
    assert.ok(body.includes("<pre>"))
    assert.ok(!body.includes("````text"), "the canonical tree replaced the text fence")
    assert.ok(!body.includes("job log ↗"), "the separate run-link label is retired (A7)")
    assert.ok(!body.includes("?job="), "run-level permalink without ?job= (ENG-1355)")
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

test("explainer opens through the first-commit lifecycle and collapses after (v6.2 §1.4)", () => {
    const openExplainer = "<details open><summary><sub>💡 how to read this"

    // First comment on the PR: firstRun — the explainer renders open.
    const createPlan = planPullRequestComment([], worth, 1, RENDER_OPTIONS)
    assert.equal(createPlan.kind, "create")
    assert.ok(createPlan.body.includes(openExplainer), "first post renders the explainer open")

    // Updating the SAME commit's comment is still the first-commit
    // lifecycle: the explainer stays open.
    const updatePlan = planPullRequestComment([{ id: 1, body: createPlan.body }], worth, 2, RENDER_OPTIONS)
    assert.equal(updatePlan.kind, "update")
    assert.ok(updatePlan.body.includes(openExplainer), "same-commit update keeps the explainer open")

    // A prior Garnet comment for a DIFFERENT commit ends the first-commit
    // lifecycle: the explainer collapses.
    const otherSha = worth.github.sha.replace(/^./, worth.github.sha.startsWith("f") ? "0" : "f")
    const otherProfile = { ...worth, github: { ...worth.github, sha: otherSha } }
    const otherBody = renderCommentBody(stateFor(otherProfile), RENDER_OPTIONS)
    const secondCommitPlan = planPullRequestComment([{ id: 1, body: otherBody }], worth, 1, RENDER_OPTIONS)
    assert.equal(secondCommitPlan.kind, "create")
    assert.ok(!secondCommitPlan.body.includes(openExplainer), "second commit collapses the explainer")

    // A Garnet-marked comment we cannot attribute also counts as history.
    const foreign = [{ id: 9, body: `${RUNTIME_REVIEW_MARKER}\nsome earlier garnet comment` }]
    const foreignPlan = planPullRequestComment(foreign, worth, 1, RENDER_OPTIONS)
    assert.equal(foreignPlan.kind, "create")
    assert.ok(!foreignPlan.body.includes(openExplainer), "unattributable garnet comment collapses the explainer")
})

test("report link targets the tokenless PUBLIC run route (§1.1), run-level", () => {
    const link = buildReportLink({ repository: "x/y", run_id: "28492112239", job: "runtime-review" })
    assert.equal(link, "https://app.garnet.ai/public/runs/28492112239?utm_source=github&utm_medium=pr_comment")
    assert.ok(!link.includes("/dashboard/"), "never the authed dashboard route")
    assert.ok(!link.includes("?job="), "run-level: no ?job= selector (ENG-1355)")
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
