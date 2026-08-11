/**
 * Integration gate: the action's PR-comment path (parseProfileJson →
 * mergeCommentState → renderCommentBody) renders the Runtime Review
 * byte-identically to the reference v6.6.1 render path, keeps the action's
 * state-marker machinery intact, stands down to control-plane comments on
 * both the create and the update paths (the dedupe contract from PR #78),
 * and drives the explainer's open state through the first-commit lifecycle.
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
    profilePermalink,
    COMMENT_MARKER,
    RUNTIME_REVIEW_MARKER,
    CONTROL_PLANE_MARKERS,
} from "../src/runtime-review.js"
import { publishPullRequestCommentWithClient } from "../src/pr-comment.js"

const here = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(here, "fixtures")

async function loadProfileJson(name) {
    return readFile(join(fixturesDir, "profiles", name), "utf8")
}

function stateFor(profile) {
    const merged = mergeCommentState(null, profile, 1)
    assert.equal(merged.kind, "updated")
    return merged.state
}

const worthRaw = JSON.parse(await loadProfileJson("worth-a-look-run.json"))
const worth = parseProfileJson(await loadProfileJson("worth-a-look-run.json"))
const body = renderCommentBody(stateFor(worth))

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
    assert.equal(state.version, 3)
    assert.equal(state.profiles.length, 1)
    assert.equal(state.profiles[0].github.run_id, worth.github.run_id)
})

test("normalized profile preserves the full v6.6.1 job record", () => {
    const job = worth.job
    assert.ok(job.edges.length > 0)
    const withPorts = job.edges.filter(edge => edge.remote_ports.length > 0)
    assert.ok(withPorts.length > 0, "edges carry recorded remote ports")
    assert.ok(job.counts.associations > 0)
    assert.ok(job.counts.destinations > 0)
    // The round-tripped state carries the identical job record.
    const state = parseCommentState(body)
    assert.deepEqual(state.profiles[0].job, job)
})

test("comment body renders byte-identically to the reference v6.6.1 render path", async () => {
    const raw = JSON.parse(await loadProfileJson("worth-a-look-run.json"))
    const job = summarizeProfile(raw)
    assert.ok(job !== null)
    const reference = renderRunReview(
        buildRunReview({
            repo: job.repository,
            sha: job.sha,
            commitUrl: `https://github.com/${job.repository}/commit/${job.sha}`,
            appUrl: "https://app.garnet.ai",
            jobs: [job],
        }),
    )
    const markerPrefix = `${RUNTIME_REVIEW_MARKER}\n${COMMENT_MARKER}\n<!-- garnet:commit ${job.sha} -->\n`
    assert.ok(reference.startsWith(markerPrefix))
    const content = body.split("\n").slice(6).join("\n")
    assert.equal(content, reference.slice(markerPrefix.length))
})

test("comment body carries the v6.9 anatomy: headline, meta line, job fold, explainer tree", () => {
    assert.match(body, /\*\*Execution Profiles recorded for 1 job, triggered by \[`[0-9a-f]{7}`\]/)
    assert.ok(body.includes("execution chain"))
    assert.ok(body.includes("recorded at the kernel by Garnet"))
    assert.ok(body.includes("💡 How to read this"))
    assert.ok(body.includes("<pre>"))
    assert.ok(body.includes("follow a path downward to see what ran and what it did"))
    assert.ok(body.includes("names on the path = processes · ○ = observed action · (…) = context"))
    assert.ok(!body.includes("````text"), "the canonical tree replaced the text fence")
    assert.ok(!body.includes("job log ↗"), "the separate run-link label is retired (A7)")
    assert.ok(!body.includes("?job="), "no legacy ?job= selector (ENG-1355)")
})

test("profile permalink is profile-scoped when the envelope ID exists, absent when it doesn't", () => {
    // A control-plane envelope carries the profile ID: the permalink is the
    // exact public profile selector.
    const enveloped = summarizeProfile({ id: "019f1b61-9f3c-7ac8-a8ed-0c07bf1546af", data: worthRaw })
    assert.ok(enveloped !== null)
    const link = profilePermalink(enveloped, "https://app.garnet.ai", "pr_comment")
    assert.equal(
        link,
        `https://app.garnet.ai/public/runs/${enveloped.run_id}?profile=019f1b61-9f3c-7ac8-a8ed-0c07bf1546af&utm_source=github&utm_medium=pr_comment`,
    )

    // The action's local Jibril profile has no envelope ID: the link fails
    // closed (no run-index fallback, never a guessed selector).
    assert.equal(worth.job.profile_id, "")
    assert.equal(profilePermalink(worth.job, "https://app.garnet.ai", "pr_comment"), "")
    assert.ok(!body.includes("?profile="), "no profile selector without an envelope ID")
    assert.ok(!body.includes("/dashboard/"), "never the authed dashboard route")
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

test("explainer opens through the first-commit lifecycle and collapses after", () => {
    const openExplainer = "<details open><summary><sub>💡 How to read this"

    // First comment on the PR: firstRun — the explainer renders open.
    const createPlan = planPullRequestComment([], worth, 1)
    assert.equal(createPlan.kind, "create")
    assert.ok(createPlan.body.includes(openExplainer), "first post renders the explainer open")

    // Updating the SAME commit's comment is still the first-commit
    // lifecycle: the explainer stays open.
    const updatePlan = planPullRequestComment([{ id: 1, body: createPlan.body }], worth, 2)
    assert.equal(updatePlan.kind, "update")
    assert.ok(updatePlan.body.includes(openExplainer), "same-commit update keeps the explainer open")

    // A prior Garnet comment for a DIFFERENT commit ends the first-commit
    // lifecycle: the explainer collapses.
    const otherSha = worth.github.sha.replace(/^./, worth.github.sha.startsWith("f") ? "0" : "f")
    const otherProfile = {
        ...worth,
        github: { ...worth.github, sha: otherSha },
        job: { ...worth.job, sha: otherSha },
    }
    const otherBody = renderCommentBody(stateFor(otherProfile))
    const secondCommitPlan = planPullRequestComment([{ id: 1, body: otherBody }], worth, 1)
    assert.equal(secondCommitPlan.kind, "create")
    assert.ok(!secondCommitPlan.body.includes(openExplainer), "second commit collapses the explainer")

    // A Garnet-marked comment we cannot attribute also counts as history.
    const foreign = [{ id: 9, body: `${RUNTIME_REVIEW_MARKER}\nsome earlier garnet comment` }]
    const foreignPlan = planPullRequestComment(foreign, worth, 1)
    assert.equal(foreignPlan.kind, "create")
    assert.ok(!foreignPlan.body.includes(openExplainer), "unattributable garnet comment collapses the explainer")
})

test("report link targets the tokenless PUBLIC run route, run-level", () => {
    // report_url is emitted at action start, before any profile (and
    // therefore any profile_id) exists — it is run-level by design. The
    // profile-scoped permalink lives in the comment and Step Summary.
    const link = buildReportLink({ repository: "x/y", run_id: "28492112239", job: "runtime-review" })
    assert.equal(link, "https://app.garnet.ai/public/runs/28492112239?utm_source=github&utm_medium=pr_comment")
    assert.ok(!link.includes("/dashboard/"), "never the authed dashboard route")
})

test("legacy v2 state upgrade keeps the terminal process in the rendered lineage", () => {
    const legacyState = {
        version: 2,
        workflow_runs: { "wf\u0000job": { run_id: "1", run_attempt: 1 } },
        profiles: [
            {
                timestamp: "2026-01-01T00:00:00Z",
                github: {
                    workflow: "wf",
                    repository: "x/y",
                    ref: "refs/pull/1/merge",
                    sha: "a".repeat(40),
                    actor: "octocat",
                    run_id: "1",
                    job: "job",
                },
                egress_peers: [
                    {
                        remote_names: ["registry.npmjs.org"],
                        remote_address: "1.2.3.4",
                        proc_trees: [{ ancestry: ["Runner.Worker", "bash", "npm install"] }],
                        result: "pass",
                    },
                ],
                telemetry: { total_domains: 1, total_connections: 1 },
            },
        ],
    }
    const encoded = Buffer.from(JSON.stringify(legacyState), "utf8").toString("base64url")
    const upgraded = parseCommentState(`<!-- garnet-action-comment-state:${encoded} -->`)
    assert.ok(upgraded !== null)
    const edge = upgraded.profiles[0].job.edges[0]
    assert.equal(edge.process, "npm install")
    assert.deepEqual(edge.ancestry, ["Runner.Worker", "bash", "npm install"])
    const upgradedBody = renderCommentBody(upgraded)
    assert.ok(upgradedBody.includes("npm install"), "the terminal process renders in the tree")
})

test("final comment body (rendered review + hidden state) stays under GitHub's hard limit", () => {
    const bigEvidence = Array.from({ length: 2000 }, (_, i) => ({
        timestamp: "2026-01-01T00:00:00Z",
        event: `flow-${i}`,
        remote_peer: `host-${i}.example.com`,
        protocol: "tcp",
        ports: "443",
        result: "pass",
    }))
    const inflated = structuredClone(stateFor(worth))
    inflated.profiles[0].job.assertions = [
        {
            class_id: "net_exfiltration",
            id: "assert-huge",
            description: "synthetic oversized assertion evidence",
            result: "pass",
            evidence: bigEvidence,
        },
    ]
    const inflatedBody = renderCommentBody(inflated)
    assert.ok(Buffer.byteLength(inflatedBody, "utf8") <= 65536, "body fits GitHub's comment limit")
    const roundTripped = parseCommentState(inflatedBody)
    assert.ok(roundTripped !== null, "the carried state still round-trips")
    assert.equal(roundTripped.profiles[0].job.assertions[0].result, "pass")
})

test("publishPullRequestCommentWithClient leaves takeover comments alone when control-plane takes over", async () => {
    const calls = { listComments: 0, createBody: null, createID: 0, deletedIds: [] }
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
            calls.createID = 321
            return { id: calls.createID, body }
        },
        async updateComment() {
            throw new Error("updateComment should not be called")
        },
        async deleteComment(commentID) {
            calls.deletedIds.push(commentID)
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
