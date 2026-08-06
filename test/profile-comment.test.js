/**
 * Integration gate: the action's PR-comment path (parseProfileJson →
 * mergeCommentState → renderCommentBody) renders the execution review
 * byte-identically to the reference path, keeps the action's state-marker
 * machinery intact (including the version-2 → version-3 state upgrade), and
 * stands down to control-plane comments on both the create and the update
 * paths.
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

async function loadProfileJson(name) {
    const raw = JSON.parse(await readFile(join(fixturesDir, "profiles", name), "utf8"))
    // The captured testbed profiles predate the timestamp field.
    return JSON.stringify({ timestamp: "2026-07-03T14:02:00Z", ...raw })
}

function stateFor(profile) {
    const merged = mergeCommentState(null, profile, 1)
    assert.equal(merged.kind, "updated")
    return merged.state
}

const worth = parseProfileJson(await loadProfileJson("worth-a-look-run.json"))
const body = renderCommentBody(stateFor(worth), { explainerOpen: true })

test("comment body: runtime-review marker first, then the action's state markers", () => {
    const lines = body.split("\n")
    assert.equal(lines[0], RUNTIME_REVIEW_MARKER)
    assert.equal(lines[1], COMMENT_MARKER)
    assert.equal(lines[2], `<!-- ${ACTION_COMMENT_MARKER} -->`)
    assert.ok(lines[3].startsWith(`<!-- ${COMMIT_MARKER_PREFIX}${worth.sha}`))
    assert.ok(lines[4].startsWith("<!-- garnet-action-comment-state:"))
})

test("comment body: state marker round-trips through parseCommentState", () => {
    const state = parseCommentState(body)
    assert.ok(state !== null)
    assert.equal(state.version, 3)
    assert.equal(state.jobs.length, 1)
    assert.equal(state.jobs[0].run_id, worth.run_id)
})

test("version-2 comment state upgrades to version 3 (comment updates, never duplicates)", () => {
    const legacyState = {
        version: 2,
        workflow_runs: { "Garnet Runtime Review": { run_id: worth.run_id, run_attempt: 1 } },
        profiles: [
            {
                timestamp: "2026-07-03T14:02:00Z",
                github: {
                    workflow: "Garnet Runtime Review",
                    repository: worth.repository,
                    ref: worth.ref,
                    sha: worth.sha,
                    actor: worth.actor,
                    run_id: worth.run_id,
                    job: worth.name,
                },
                assertions: [],
                egress_peers: [
                    {
                        remote_names: ["registry.npmjs.org"],
                        remote_address: "104.16.6.34",
                        proc_trees: [{ ancestry: ["bash", "node"] }],
                        result: "pass",
                    },
                ],
                telemetry: { total_domains: 1, total_connections: 1 },
                report_link: "https://app.garnet.ai/dashboard/runs/1",
            },
        ],
    }
    const encoded = Buffer.from(JSON.stringify(legacyState), "utf8").toString("base64url")
    const legacyBody = `<!-- garnet-action-comment-state:${encoded} -->`
    const state = parseCommentState(legacyBody)
    assert.ok(state !== null)
    assert.equal(state.version, 3)
    assert.equal(state.jobs[0].name, worth.name)
    assert.equal(state.jobs[0].sha, worth.sha)
    assert.equal(state.jobs[0].edges[0].remote_names[0], "registry.npmjs.org")

    // The same job's next run replaces the upgraded record wholesale.
    const merged = mergeCommentState(state, worth, 2)
    assert.equal(merged.kind, "updated")
    assert.equal(merged.state.jobs.length, 1)
    assert.equal(merged.state.jobs[0].flow_count, worth.flow_count)
})

test("comment body renders byte-identically to the reference render path", async () => {
    const raw = JSON.parse(await loadProfileJson("worth-a-look-run.json"))
    const job = summarizeProfile(raw)
    const reference = renderRunReview(
        buildRunReview({
            repo: job.repository,
            sha: job.sha,
            commitURL: `https://github.com/${job.repository}/commit/${job.sha}`,
            appURL: "https://app.garnet.ai",
            jobs: [job],
        }),
        { explainerOpen: true },
    )
    const markerPrefix = `${RUNTIME_REVIEW_MARKER}\n${COMMENT_MARKER}\n`
    assert.ok(reference.startsWith(markerPrefix))
    const content = body.split("\n").slice(5).join("\n")
    assert.equal(content, reference.slice(markerPrefix.length))
})

test("report_url output: dashboard run route, no fabricated profile selector", () => {
    assert.equal(
        buildReportLink({ repository: "o/r", run_id: "28492112239", job: "j" }),
        "https://app.garnet.ai/dashboard/runs/28492112239",
    )
    assert.equal(buildReportLink({ repository: "o/r", run_id: "", job: "j" }), "https://app.garnet.ai")
})

test("stand-down: control-plane comment blocks the CREATE path", () => {
    const comments = [{ id: 1, body: `<!-- ${CONTROL_PLANE_MARKERS[0]} -->\nCP comment` }]
    const plan = planPullRequestComment(comments, worth, 1)
    assert.equal(plan.kind, "blocked-by-control-plane")
})

test("stand-down: control-plane comment blocks the UPDATE path too", () => {
    const comments = [
        { id: 1, body },
        { id: 2, body: `<!-- ${CONTROL_PLANE_MARKERS[1]} -->\nCP pending comment` },
    ]
    const plan = planPullRequestComment(comments, worth, 2)
    assert.equal(plan.kind, "blocked-by-control-plane")
})

test("no control-plane comment: update path proceeds normally", () => {
    const plan = planPullRequestComment([{ id: 1, body }], worth, 2)
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

            return [{ id: 100, body: `<!-- ${CONTROL_PLANE_MARKERS[0]} -->\nCP comment` }]
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
    })

    assert.equal(result, "skipped-control-plane")
    assert.ok(calls.createBody !== null)
    assert.deepEqual(calls.deletedIds, [])
    assert.equal(calls.listComments, 3)
})
