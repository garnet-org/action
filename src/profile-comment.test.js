import assert from "node:assert/strict"
import { test } from "node:test"
import {
    ACTION_COMMENT_MARKER,
    COMMIT_MARKER_PREFIX,
    RUNTIME_REVIEW_MARKER,
    mergeCommentState,
    parseCommentState,
    renderCommentBody,
} from "./profile-comment.js"
import { planPullRequestComment } from "./pr-comment-plan.js"

/** @typedef {import("./profile-comment.js").NormalizedProfile} NormalizedProfile */
/** @typedef {import("./profile-comment.js").CommentState} CommentState */

const BANNED_WORDS = [
    "pass",
    "passed",
    "fail",
    "failed",
    "attention",
    "clean",
    "routine",
    "usual",
    "check",
    "detection",
    "verdict",
    "risk",
    "severity",
    "threat",
    "malicious",
    "suspicious",
    "block",
]

const BANNED_GLYPHS = ["🔴", "✅", "⚠", "🛑", "🔍", "❓"]

const BANNED_WORD_PATTERN = new RegExp(`\\b(${BANNED_WORDS.join("|")})\\b`, "i")

/**
 * @param {Partial<NormalizedProfile["github"]>} github
 * @param {Partial<NormalizedProfile>} overrides
 * @returns {NormalizedProfile}
 */
function makeProfile(github = {}, overrides = {}) {
    return {
        timestamp: "2026-07-01T00:00:00Z",
        github: {
            workflow: "CI",
            repository: "garnet-org/example",
            ref: "refs/pull/1/merge",
            sha: "0123456789abcdef0123456789abcdef01234567",
            actor: "octocat",
            run_id: "12345",
            job: "e2e",
            ...github,
        },
        assertions: [
            { id: "assertion-one", result: "pass" },
            { id: "assertion-two", result: "fail" },
        ],
        egress_peers: [
            {
                remote_address: "104.16.10.34",
                remote_names: ["registry.npmjs.org"],
                proc_trees: [{ ancestry: ["npm install", "node"] }],
                result: "pass",
            },
            {
                remote_address: "45.137.21.88",
                remote_names: ["img-cdn-assets.com"],
                proc_trees: [{ ancestry: ["npm install", "node", "sh -c", "curl"] }],
                result: "fail",
            },
        ],
        telemetry: { total_domains: 2, total_connections: 12 },
        report_link: "https://app.garnet.ai/dashboard/runs/12345?utm_source=github&utm_medium=pr_comment",
        ...overrides,
    }
}

/**
 * @param {NormalizedProfile[]} profiles
 * @returns {CommentState}
 */
function makeState(profiles) {
    return {
        version: 2,
        workflow_runs: Object.fromEntries(
            profiles.map(profile => [profile.github.workflow, { run_id: profile.github.run_id, run_attempt: 1 }]),
        ),
        profiles,
    }
}

/**
 * @param {string} body
 * @returns {string}
 */
function stripHtmlCommentMarkers(body) {
    return body.replaceAll(/<!--[\s\S]*?-->/g, "")
}

function renderFixtureBodies() {
    return [
        renderCommentBody(makeState([makeProfile()])),
        renderCommentBody(
            makeState([
                makeProfile(),
                makeProfile(
                    { workflow: "Docs", job: "build-docs" },
                    { egress_peers: [], telemetry: { total_domains: 0, total_connections: 0 } },
                ),
            ]),
        ),
        renderCommentBody(
            makeState([
                makeProfile({}, { egress_peers: [], telemetry: { total_domains: 0, total_connections: 0 } }),
            ]),
        ),
    ]
}

test("rendered comment contains no banned vocabulary or status glyphs", () => {
    for (const body of renderFixtureBodies()) {
        const rendered = stripHtmlCommentMarkers(body)
        const wordMatch = rendered.match(BANNED_WORD_PATTERN)
        assert.equal(wordMatch, null, `banned word ${JSON.stringify(wordMatch?.[0])} found in rendered comment`)

        for (const glyph of BANNED_GLYPHS) {
            assert.ok(!rendered.includes(glyph), `banned glyph ${glyph} found in rendered comment`)
        }
    }
})

test("rendered comment emits runtime-review, action, and commit markers", () => {
    const body = renderCommentBody(makeState([makeProfile()]))

    assert.ok(body.includes(`<!-- ${RUNTIME_REVIEW_MARKER} -->`))
    assert.ok(body.includes(`<!-- ${ACTION_COMMENT_MARKER} -->`))
    assert.ok(body.includes(`<!-- ${COMMIT_MARKER_PREFIX}0123456789abcdef0123456789abcdef01234567 -->`))
})

test("rendered comment follows the observation-only anatomy", () => {
    const body = renderCommentBody(
        makeState([
            makeProfile(),
            makeProfile(
                { workflow: "Docs", job: "build-docs" },
                { egress_peers: [], telemetry: { total_domains: 0, total_connections: 0 } },
            ),
        ]),
    )

    assert.ok(body.includes("## Garnet Runtime Review"))
    assert.ok(body.includes("garnet-org/example · 0123456 · 2 jobs · 2 workflows"))
    assert.ok(body.includes("```text"))
    assert.ok(body.includes("→ registry.npmjs.org · 104.16.10.34"))
    assert.ok(body.includes("→ img-cdn-assets.com · 45.137.21.88"))
    assert.ok(body.includes("`build-docs` · Docs — made no outbound connections."))
    assert.ok(body.includes("<details>"))
    assert.ok(body.includes("<summary>Full process & network evidence · 2 jobs · 2 domains · 12 connections</summary>"))
    assert.ok(!body.includes("| ---"), "evidence fold must not contain markdown tables")
    assert.ok(body.includes("<sub>What happened in this PR — each job's processes and where they reached."))
    assert.ok(body.includes("[Run Profile ↗]("))
    assert.ok(!body.includes("Assertions"), "phase 1 must not render assertions")
})

test("headline reports spawn topology for a single job profile", () => {
    const body = renderCommentBody(makeState([makeProfile()]))

    assert.ok(body.includes("In `e2e`, `node` spawned `sh -c → curl`, which reached `img-cdn-assets.com`."))
})

test("headline reports within-run uniqueness when multiple job profiles exist", () => {
    const shared = {
        remote_address: "104.16.10.34",
        remote_names: ["registry.npmjs.org"],
        proc_trees: [{ ancestry: ["npm install", "node"] }],
        result: /** @type {const} */ ("pass"),
    }
    const body = renderCommentBody(
        makeState([
            makeProfile(),
            makeProfile(
                { workflow: "Docs", job: "build-docs" },
                { egress_peers: [shared], telemetry: { total_domains: 1, total_connections: 3 } },
            ),
        ]),
    )

    assert.ok(body.includes("`img-cdn-assets.com` — a destination no other job in this run reached."))
})

test("rendered comment state round-trips", () => {
    const state = makeState([makeProfile()])
    const body = renderCommentBody(state)

    assert.deepEqual(parseCommentState(body), state)
})

test("merged profiles re-render deterministically", () => {
    const profile = makeProfile()
    const merged = mergeCommentState(null, profile, 1)

    assert.equal(merged.kind, "updated")
    if (merged.kind === "updated") {
        assert.equal(renderCommentBody(merged.state), renderCommentBody(merged.state))
    }
})

test("action defers to existing control-plane comments", () => {
    const plan = planPullRequestComment(
        [{ id: 1, body: "<!-- garnet-control-plane-pr-comment:v1 -->\nsome app comment" }],
        makeProfile(),
        1,
    )

    assert.deepEqual(plan, { kind: "blocked-by-control-plane" })
})
