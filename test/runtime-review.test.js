/**
 * Spec gate for the observation-only Garnet Runtime Review renderer
 * (Comment v5.2), ported from the locked reference test suite in
 * garnet-labs/runtime-review-testbed (review.test.mjs): v5.1 acceptance
 * tests 18–27, the v5.2 readability invariants, the banned-vocabulary/glyph
 * hard gate, and byte-comparison against the checked-in real-data mockups.
 *
 *   node --test test/
 */
import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import {
    buildRunReview,
    renderRunReview,
    renderStepSummary,
    renderJobTree,
    jobSummaryLine,
    summarizeProfile,
    classifyConnection,
    derivePermalink,
    behaviorSignature,
    normalizeIdentifier,
    freshnessStamp,
    renderNoRecord as renderNoRecordBody,
    SIZE_BUDGET,
    COMMENT_MARKER,
    RUNTIME_REVIEW_MARKER,
} from "../src/runtime-review.js"

const here = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(here, "fixtures")

const REPO = "garnet-labs/runtime-review-testbed"

/** Pinned render clock so renders stay byte-identical (A7 freshness stamp). */
const RENDERED_AT = "2026-07-03T14:02:00Z"

/** Example capability link (A6): the tokenless public Run Profile page. */
const CAPABILITY_LINK = "https://app.garnet.ai/p/runtime-review-testbed"

const DOCS_URL = "https://github.com/garnet-org/action#readme"

async function loadProfile(name) {
    return JSON.parse(await readFile(join(fixturesDir, "profiles", name), "utf8"))
}

/** Render one or more real profiles through the exact CI code path. */
function renderFromProfiles(profiles, { permalink = "", expectedJobs = profiles.length } = {}) {
    const jobs = profiles.map(summarizeProfile).filter(Boolean)
    const sha = jobs[0]?.sha || ""
    const review = buildRunReview({
        repo: REPO,
        sha,
        commitUrl: sha ? `https://github.com/${REPO}/commit/${sha}` : "",
        permalink,
        docsUrl: DOCS_URL,
        expectedJobs,
        renderedAt: RENDERED_AT,
        jobs,
    })
    return { review, body: renderRunReview(review) }
}

/** The no-record placeholder body with the PR-comment markers prepended. */
function renderNoRecord(sha) {
    return [
        RUNTIME_REVIEW_MARKER,
        COMMENT_MARKER,
        renderNoRecordBody({
            sha,
            commitUrl: `https://github.com/${REPO}/commit/${sha}`,
            expectedJobs: 1,
            docsUrl: DOCS_URL,
            renderedAt: RENDERED_AT,
        }),
    ].join("\n")
}

// ---------------------------------------------------------------------------
// Real inputs — captured from live CI runs of the testbed repo.
// ---------------------------------------------------------------------------
const normal = await loadProfile("normal-run.json") // run 28488074733 — plain npm install
const install = await loadProfile("npm-install-run.json") // run 28488074733 — install + resolver
const worth = await loadProfile("worth-a-look-run.json") // run 28492112239 — unsplash fetch in npm test
const sample = await loadProfile("sample-profile.json")

const STATES = {
    "no-record": renderNoRecord("ef01a52517e7532ab34aadea58b952c9f1e79ece"),
    "registry-only": renderFromProfiles([normal]).body,
    "workload-egress": renderFromProfiles([worth]).body,
    "multi-job": renderFromProfiles([install, worth]).body,
    "partial-coverage": renderFromProfiles([worth], { expectedJobs: 6 }).body,
}

// Synthetic jobs used only where no real profile can produce the edge case.
const CANARY_JOB = {
    name: "runtime-review",
    workflow: "Garnet Runtime Review",
    run_url: "https://github.com/garnet-labs/runtime-review-testbed/actions/runs/1",
    connections: [
        { ancestry: ["systemd", "hosted-compute-agent", "Runner.Listener", "Runner.Worker", "bash", "node", "dash", "node", "dash", "curl"], domain: "httpbin.org", ip: "98.95.76.254" },
        { ancestry: ["systemd", "hosted-compute-agent", "Runner.Listener", "Runner.Worker", "bash", "node", "dash", "node", "dash", "curl"], domain: "localhost", ip: "127.0.0.53" },
        { ancestry: ["systemd", "hosted-compute-agent", "Runner.Listener", "Runner.Worker", "bash", "node", "dash", "node"], domain: "registry.npmjs.org", ip: "104.16.6.34" },
        { ancestry: ["systemd", "hosted-compute-agent", "Runner.Listener", "Runner.Worker", "bash", "node", "dash", "node"], domain: "api.garnet.ai", ip: "104.26.11.16" },
        { ancestry: ["systemd", "hosted-compute-agent", "Runner.Listener", "Runner.Worker", "bash", "node", "dash", "node"], domain: "localhost", ip: "127.0.0.53" },
        { ancestry: ["systemd", "hosted-compute-agent", "Runner.Listener", "Runner.Worker", "bash", "node", "dash", "node"], domain: "github.com", ip: "140.82.116.3" },
        { ancestry: ["systemd", "hosted-compute-agent", "Runner.Listener", "Runner.Worker", "bash", "node"], domain: "registry.npmjs.org", ip: "104.16.4.34" },
        { ancestry: ["systemd", "hosted-compute-agent", "Runner.Listener", "Runner.Worker", "bash", "node"], domain: "localhost", ip: "127.0.0.53" },
        { ancestry: ["systemd", "hosted-compute-agent", "sudo", "provjobd128037216"], domain: "", ip: "168.63.129.16" },
    ],
}

const canaryReview = () =>
    buildRunReview({
        repo: "garnet-labs/runtime-review-testbed",
        sha: "ac543cb0000000000000000000000000000000000",
        commitUrl: "https://github.com/garnet-labs/runtime-review-testbed/commit/ac543cb",
        permalink: "https://app.garnet.ai/p/runtime-review-testbed",
        docsUrl: DOCS_URL,
        renderedAt: RENDERED_AT,
        jobs: [CANARY_JOB],
    })

const CANARY = renderRunReview(canaryReview())

// ---------------------------------------------------------------------------
// Spec §1 banned vocabulary — observations, never verdicts (hard gate).
// ---------------------------------------------------------------------------
const BANNED_WORDS = [
    "pass", "passed", "fail", "failed", "attention", "clean", "routine",
    "usual", "check", "detection", "verdict", "risk", "severity", "threat",
    "malicious", "suspicious", "block",
]
const BANNED_WORDS_RE = new RegExp(`\\b(${BANNED_WORDS.join("|")})(s|es|ed|ing)?\\b`, "i")
const BANNED_GLYPHS_RE = /[✅🛑🔍🔴⚠⏳]/u

for (const [name, md] of Object.entries({ ...STATES, canary: CANARY })) {
    test(`[${name}] canonical marker first, self-marker second`, () => {
        assert.ok(md.startsWith(RUNTIME_REVIEW_MARKER), "starts with the canonical marker")
        assert.ok(md.includes(COMMENT_MARKER), "carries the self-marker (takeover window)")
    })
    test(`[${name}] anatomy: title + A7 meta line`, () => {
        assert.ok(md.includes("## Garnet Runtime Review"))
        assert.match(
            md,
            /\[`[0-9a-f]{7}`\]\(https:\/\/github\.com\/[^)]+\/commit\/[^)]+\) · (?:\d+ of \d+ jobs? recorded|\d+ jobs? recorded) · updated \d{2}:\d{2} UTC · [A-Z][a-z]{2} \d{1,2}/,
        )
    })
    test(`[${name}] no banned vocabulary or status glyphs`, () => {
        const hit = md.match(BANNED_WORDS_RE)
        assert.ok(!hit, `found banned word "${hit && hit[0]}"`)
        assert.ok(!BANNED_GLYPHS_RE.test(md), "found a status glyph")
    })
    test(`[${name}] no tables, images, svg, color styling, or repo name in meta`, () => {
        assert.ok(!/^\s*\|/m.test(md), "markdown table found")
        assert.ok(!/!\[|<svg|style=|color:/i.test(md))
        assert.ok(!/^`garnet-labs\//m.test(md), "repo name must not lead the meta line (A7)")
    })
    test(`[${name}] footer <sub> present, no relative time`, () => {
        assert.match(md, /<sub>What happened in this PR — each job's processes and where they reached\./)
        assert.ok(!/\bago\b/.test(md), "the string 'ago' never appears (test 25)")
    })
}

for (const [name, md] of Object.entries(STATES)) {
    if (name === "no-record") continue
    test(`[${name}] lineage trees are four-backtick-fenced with → leaf annotations`, () => {
        assert.ok(md.includes("````text"), "four-backtick fences (A8)")
        assert.match(md, /^\s*[├└]─ → [\w.-]+/m)
    })
    test(`[${name}] job row: summary line IS the fold summary; named slots + totals`, () => {
        assert.match(md, /<details( open)?><summary><b><code>[\w-]+<\/code><\/b> — reached .*· \d+ connections?<\/summary>/)
        assert.match(md, /\[job log ↗\]\(https:\/\/github\.com\/[^)]+\/actions\/runs\/\d+\)/)
    })
    test(`[${name}] agent-prompt hint + job log live inside the fold (D6)`, () => {
        assert.match(md, /<sub>Paste the tree into your review agent · full detail in the Step Summary · \[job log ↗\][^<]*<\/sub>/)
    })
}

// ---------------------------------------------------------------------------
// v5.1 acceptance tests 18–27.
// ---------------------------------------------------------------------------
test("18: resolver stub renders → dns, never localhost; excluded from candidacy, kept in counts", () => {
    assert.match(CANARY, /→ dns · 127\.0\.0\.53/)
    assert.ok(!/`localhost`/.test(CANARY), "localhost never named in prose")
    assert.match(CANARY, /<summary><b><code>[\w-]+<\/code><\/b> — reached .*· 9 connections<\/summary>/)
})
test("19: the sensor's upload renders — garnet upload, excluded from candidacy, kept in counts", () => {
    assert.match(CANARY, /→ api\.garnet\.ai · 104\.26\.11\.16 — garnet upload/)
    assert.ok(!CANARY.includes("`api.garnet.ai`"), "garnet upload never headlines or enumerates")
})
test("20: runner ancestry compresses to one line; deviation cancels elision", () => {
    assert.match(CANARY, /└─ GitHub runner ┄ \d+ processes(?: · \d+ connections? → GitHub-owned addresses)?/)
    assert.ok(!/^\s*[├└]─ systemd$/m.test(CANARY), "systemd never renders as its own node")
    // Cancellation: a runner-chain member reaching an unclassified destination
    // renders that branch in full.
    const cancel = buildRunReview({
        sha: "ac543cb", renderedAt: RENDERED_AT,
        jobs: [{ name: "j", connections: [
            { ancestry: ["systemd", "sudo", "provjobd99"], domain: "transfer.sh", ip: "1.2.3.4" },
        ] }],
    })
    const tree = renderJobTree(cancel.jobs[0])
    assert.ok(tree.includes("provjobd99"), "member reaching non-GitHub destination renders in full")
    assert.ok(tree.includes("transfer.sh"))
})
test("21: headline destination is never a classified connection (the stub can never headline)", () => {
    assert.match(CANARY, /In `runtime-review`, `dash` spawned `curl`, which reached `httpbin\.org`\./)
})
test("22: named enumeration slots are never all classified/high-frequency entries", () => {
    assert.match(CANARY, /<b><code>runtime-review<\/code><\/b> — reached <code>httpbin\.org<\/code>, <code>github\.com<\/code>, <code>registry\.npmjs\.org<\/code> and \d+ more · 9 connections/)
    assert.ok(!/reached <code>registry\.npmjs\.org<\/code>, <code>api\.garnet\.ai<\/code>/.test(CANARY), "slots are salience-ordered, not first-seen")
})
test("23: R0 signatures normalize trailing digits; display shows the raw name", () => {
    assert.equal(normalizeIdentifier("provjobd128037216"), "provjobd*")
    const a = behaviorSignature({ ancestry: ["sudo", "provjobd128037216"], domain: "x.com" })
    const b = behaviorSignature({ ancestry: ["sudo", "provjobd131111111"], domain: "x.com" })
    assert.equal(a, b)
})
test("24: link policy — Run Profile ↗ never targets a github.com/actions URL; omitted when absent", () => {
    assert.ok(!/\[Run Profile ↗\]\(https:\/\/github\.com\/[^)]*\/actions\//.test(CANARY))
    const noCap = renderRunReview(buildRunReview({
        sha: "ac543cb", renderedAt: RENDERED_AT,
        permalink: "https://github.com/garnet-labs/runtime-review-testbed/actions/runs/1",
        jobs: [CANARY_JOB],
    }))
    assert.ok(!noCap.includes("Run Profile ↗"), "footer omits the link rather than mislabeling")
})
test("25: timestamps are absolute UTC", () => {
    assert.match(CANARY, /updated 14:02 UTC · Jul 3/)
    assert.equal(freshnessStamp(new Date(RENDERED_AT)), "updated 14:02 UTC · Jul 3")
})
test("26: hostile process name renders inert inside an intact four-backtick fence; byte-identical reruns", () => {
    const hostile = buildRunReview({
        sha: "ac543cb", renderedAt: RENDERED_AT,
        jobs: [{ name: "j", connections: [
            { ancestry: ["bash", "```](https://x.com)\u0007"], domain: "example.com", ip: "9.9.9.9" },
        ] }],
    })
    const one = renderRunReview(hostile)
    const two = renderRunReview(hostile)
    assert.equal(one, two, "byte-identical across reruns")
    assert.ok(!/```\]/.test(one), "backtick run neutralized")
    assert.ok(!one.includes("\u0007"), "control characters stripped")
    const fences = one.match(/````/g) || []
    assert.equal(fences.length % 2, 0, "fences stay balanced")
})
test("27: a 500-process profile renders under the size budget with explicit collapse markers", () => {
    const big = {
        name: "big-job",
        connections: Array.from({ length: 500 }, (_, i) => ({
            ancestry: ["bash", `orchestrator-process-${i}`, `worker-subprocess-${i}`, `network-helper-tool-${i}`],
            domain: `long-destination-hostname-${i}.example-service.example.com`,
            ip: `10.0.${Math.floor(i / 250)}.${i % 250}`,
        })),
    }
    const review = buildRunReview({ sha: "ac543cb", renderedAt: RENDERED_AT, jobs: [big] })
    const body = renderRunReview(review)
    assert.ok(body.length <= SIZE_BUDGET, `body is ${body.length} chars`)
    assert.ok(body.includes("full tree in the Step Summary"), "collapse marker present")
    assert.ok(body.includes("## Garnet Runtime Review"))
    assert.match(body, /<summary><b><code>big-job<\/code><\/b> — reached/, "job line intact")
})

// ---------------------------------------------------------------------------
// v5.2 readability invariants.
// ---------------------------------------------------------------------------
test("v5.2: headline is the only prose above the folds — no meta-chatter", () => {
    assert.ok(!CANARY.includes("all shown below"), "no fold-summary meta-chatter")
    assert.ok(!CANARY.includes("paste into your review agent</summary>"), "prompt lives inside the fold")
    assert.match(CANARY, /<sub>Paste the tree into your review agent · full detail in the Step Summary/)
})
test("v5.2: salient job's tree focuses on the salient branch; siblings compress", () => {
    const review = buildRunReview({
        sha: "ac543cb", renderedAt: RENDERED_AT,
        jobs: [
            { name: "e2e", connections: [
                { ancestry: ["bash", "node", "sh -c", "curl"], domain: "img-cdn-assets.com", ip: "45.137.21.88" },
                { ancestry: ["bash", "node"], domain: "registry.npmjs.org", ip: "104.16.10.34" },
                { ancestry: ["bash", "make", "wget"], domain: "cache.example.com", ip: "1.1.1.1" },
                { ancestry: ["bash", "make", "wget"], domain: "mirror.example.com", ip: "1.1.1.2" },
            ] },
            { name: "docs", connections: [
                { ancestry: ["bash", "node"], domain: "registry.npmjs.org", ip: "104.16.10.34" },
            ] },
        ],
    })
    const body = renderRunReview(review)
    assert.ok(body.includes("img-cdn-assets.com"), "salient branch fully expanded")
    assert.match(body, /┄ \d+ more destinations? · \d+ connections? — full tree in the Step Summary ↗/, "off-path siblings compress to one aggregate line")
    const fences = body.match(/````text[\s\S]*?````/g) || []
    assert.ok(!fences[0].includes("cache.example.com") && !fences[0].includes("mirror.example.com"), "non-salient subtree does not enumerate in the salient tree")
    const summary = renderStepSummary(review)
    assert.ok(summary.includes("cache.example.com") && summary.includes("mirror.example.com"), "step summary keeps full detail")
})
test("v5.2: 4+ jobs — top jobs render individually, the rest group into one fold", () => {
    const mkJob = (name, dest) => ({
        name,
        connections: [{ ancestry: ["bash", "node"], domain: dest, ip: "9.9.9.9" }],
    })
    const review = buildRunReview({
        sha: "ac543cb", renderedAt: RENDERED_AT,
        jobs: [
            mkJob("alpha", "one.example.com"),
            mkJob("beta", "shared.example.com"),
            mkJob("gamma", "shared.example.com"),
            mkJob("delta", "shared.example.com"),
            mkJob("epsilon", "shared.example.com"),
            mkJob("zeta", "shared.example.com"),
        ],
    })
    const body = renderRunReview(review)
    assert.match(body, /<details><summary>3 more jobs · \d+ domains? · \d+ connections?<\/summary>/)
    const three = buildRunReview({
        sha: "ac543cb", renderedAt: RENDERED_AT,
        jobs: [mkJob("a", "x.example.com"), mkJob("b", "y.example.com"), mkJob("c", "z.example.com")],
    })
    assert.ok(!/more jobs ·/.test(renderRunReview(three)), "no group fold under 5 jobs")
    // The headline-picked job always renders individually, never inside the
    // group fold, even when many jobs share its rung and it sorts late by name.
    const spawn = (name, dest) => ({
        name,
        connections: [{ ancestry: ["bash", "sh -c", "curl"], domain: dest, ip: "9.9.9.9" }],
    })
    const tie = buildRunReview({
        sha: "ac543cb", renderedAt: RENDERED_AT,
        jobs: [
            spawn("alpha", "shared.example.com"),
            spawn("beta", "shared.example.com"),
            spawn("gamma", "shared.example.com"),
            spawn("delta", "shared.example.com"),
            spawn("zeta", "aaa-unique.example.com"),
        ],
    })
    const tieBody = renderRunReview(tie)
    const foldAt = tieBody.indexOf("more jobs ·")
    const zetaAt = tieBody.indexOf("<b><code>zeta</code></b>")
    assert.ok(foldAt !== -1 && zetaAt !== -1 && zetaAt < foldAt, "salient job renders before the group fold")
})
test("A6: Run Profile permalink derives from the profile's run_id when not explicit", () => {
    assert.equal(
        derivePermalink("", [{ run_id: "28674550787" }], "https://app.garnet.ai"),
        "https://app.garnet.ai/dashboard/runs/28674550787?utm_source=github&utm_medium=pr_comment",
    )
    assert.equal(
        derivePermalink("https://app.garnet.ai/p/x", [{ run_id: "1" }], "https://app.garnet.ai"),
        "https://app.garnet.ai/p/x",
        "explicit permalink wins",
    )
    assert.equal(derivePermalink("", [{}], "https://app.garnet.ai"), "", "no run_id → omitted")
    const { review } = renderFromProfiles([worth], {
        permalink: derivePermalink("", [{ run_id: "99" }], "https://app.garnet.ai"),
    })
    assert.match(
        renderRunReview(review),
        /\[Run Profile ↗\]\(https:\/\/app\.garnet\.ai\/dashboard\/runs\/99\?utm_source=github&utm_medium=pr_comment\)/,
    )
})
test("v5.2: sensor upload classifies for dev API hosts too", () => {
    assert.equal(classifyConnection({ ancestry: ["node"], domain: "dev-api.garnet.ai", ip: "1.2.3.4" }), "garnet upload")
    assert.equal(classifyConnection({ ancestry: ["node"], domain: "api.garnet.ai", ip: "1.2.3.4" }), "garnet upload")
    assert.equal(classifyConnection({ ancestry: ["node"], domain: "not-garnet.ai", ip: "1.2.3.4" }), "")
})

// ---------------------------------------------------------------------------
// Progressive disclosure: the Step Summary is the FULL-detail snapshot —
// every job's complete tree inline (no elision), nothing folded, no markers.
// ---------------------------------------------------------------------------
test("step summary renders full detail: trees inline, no folds, no elision, no markers", () => {
    const { review } = renderFromProfiles([install, worth])
    const summary = renderStepSummary(review)
    assert.ok(summary.includes("## Garnet Runtime Review"))
    assert.ok(!summary.includes("<details"), "step summary must not fold anything")
    assert.ok(!summary.includes(COMMENT_MARKER), "markers are PR-comment-only")
    assert.ok(!summary.includes("GitHub runner ┄"), "step summary is the un-elided floor")
    const trees = summary.match(/````text/g) || []
    assert.equal(trees.length, review.jobs.filter(j => j.connections.length > 0).length)
})

// ---------------------------------------------------------------------------
// S5 — partial coverage: k of n + the one growth CTA.
// ---------------------------------------------------------------------------
test("S5: partial coverage renders k of n and the add-the-step growth CTA", () => {
    const md = STATES["partial-coverage"]
    assert.match(md, /· 1 of 6 jobs recorded ·/)
    assert.match(md, /5 jobs not yet recorded — \[add the step ↗\]\(/)
})

test("S5: unknown coverage degrades to the recorded-only meta line with no CTA", () => {
    const baseReview = buildRunReview({
        sha: "ac543cb",
        renderedAt: RENDERED_AT,
        jobs: [summarizeProfile(normal)],
    })
    const equalReview = buildRunReview({
        sha: "ac543cb",
        renderedAt: RENDERED_AT,
        expectedJobs: 1,
        jobs: [summarizeProfile(normal)],
    })
    const body = renderRunReview(baseReview)
    const equalBody = renderRunReview(equalReview)
    assert.match(body, /· 1 job recorded ·/)
    assert.ok(!body.includes("of 1 job"), "unknown coverage does not invent n")
    assert.ok(!body.includes("not yet recorded — [add the step ↗]"), "unknown coverage suppresses the CTA")
    assert.equal(body, equalBody, "absent and equal coverage render the same degraded meta line")
})

// ---------------------------------------------------------------------------
// S7 — lineage-absent degradation: no trees, no folds, sentences survive.
// ---------------------------------------------------------------------------
test("S7: lineage-absent profile renders without trees or folds", () => {
    const review = buildRunReview({
        sha: "ac543cb", renderedAt: RENDERED_AT,
        jobs: [{ name: "j", connections: [{ ancestry: [], domain: "httpbin.org", ip: "9.9.9.9" }] }],
    })
    const body = renderRunReview(review)
    assert.ok(!body.includes("<details"))
    assert.ok(!body.includes("````text"))
    assert.match(body, /^\*\*`j`\*\* — reached `httpbin\.org`/m)
})

// ---------------------------------------------------------------------------
// A1 — classification unit coverage.
// ---------------------------------------------------------------------------
test("A1: classes derive from identity/provenance only", () => {
    assert.equal(classifyConnection({ ancestry: [], domain: "localhost", ip: "127.0.0.53" }), "dns")
    assert.equal(classifyConnection({ ancestry: [], domain: "api.garnet.ai", ip: "1.1.1.1" }), "garnet upload")
    assert.equal(
        classifyConnection({ ancestry: ["systemd", "Runner.Worker"], domain: "github.com", ip: "1.1.1.1" }),
        "github infra",
    )
    assert.equal(
        classifyConnection({ ancestry: ["systemd", "sudo", "provjobd12"], domain: "", ip: "168.63.129.16" }),
        "github infra",
    )
    // Ownership alone is not provenance: GitHub-owned destinations reached from
    // user code stay unclassified (enumerable evidence).
    assert.equal(classifyConnection({ ancestry: ["bash", "node"], domain: "github.com", ip: "1.1.1.1" }), "")
    assert.equal(classifyConnection({ ancestry: ["bash"], domain: "httpbin.org", ip: "9.9.9.9" }), "")
})

// ---------------------------------------------------------------------------
// Determinism: same profile payload + render clock in → same comment out.
// ---------------------------------------------------------------------------
test("deterministic render: identical bytes across repeated renders", () => {
    for (let i = 0; i < 3; i++) {
        assert.equal(renderFromProfiles([install, worth]).body, STATES["multi-job"])
        assert.equal(renderFromProfiles([worth]).body, STATES["workload-egress"])
    }
})

// ---------------------------------------------------------------------------
// Real-data salience expectations and leaf annotations.
// ---------------------------------------------------------------------------
test("R1: multi-job headline names a within-run-unique, unclassified destination", () => {
    assert.match(STATES["multi-job"], /In `runtime-review`.* — a destination no other job in this run reached\./)
    assert.ok(!/reached `dns`|reached `api\.garnet\.ai`/.test(STATES["multi-job"].split("\n")[5]))
})
test("S4: single-job uniform run falls back to the inventory sentence, fold closed", () => {
    assert.match(STATES["registry-only"], /In `runtime-review`, \d+ processes reached 1 domain over 1 connection\./)
    assert.ok(!STATES["registry-only"].includes("<details open>"), "R3 fold renders closed")
})
test("real leaf annotated with → domain · ip", () => {
    assert.ok(STATES["workload-egress"].includes("→ images.unsplash.com · 146.75.94.208"))
    assert.ok(STATES["registry-only"].includes("→ registry.npmjs.org · 104.16.5.34"))
})

// ---------------------------------------------------------------------------
// summarizeProfile over a real captured profile (Phase 1: lineage + egress).
// ---------------------------------------------------------------------------
test("summarizeProfile extracts job identity + connections from a real profile", () => {
    const s = summarizeProfile(worth)
    assert.equal(s.name, "runtime-review")
    assert.equal(s.workflow, "Garnet Runtime Review")
    assert.ok(s.connections.some(c => c.domain === "images.unsplash.com"))
    assert.ok(s.connections.every(c => Array.isArray(c.ancestry) && c.ancestry.length > 0))
})
test("summarizeProfile handles the agentic sample profile", () => {
    const s = summarizeProfile(sample)
    assert.equal(s.name, "agentic-coding-session")
    assert.ok(s.connections.some(c => c.domain === "google.com"))
})

// ---------------------------------------------------------------------------
// Vendored fixtures stay in sync with the renderer: the checked-in testbed
// mockups (mockups/real/*.md at testbed commit b7f2940) must match fresh
// renders byte-for-byte.
// ---------------------------------------------------------------------------
test("fixtures/mockups/*.md match fresh renders byte-for-byte", async () => {
    const expected = {
        "1-no-record.md": renderNoRecord(worth.scenarios?.github?.sha || "ef01a52"),
        "2-registry-only.md": renderFromProfiles([normal], { permalink: CAPABILITY_LINK }).body,
        "3-workload-egress.md": renderFromProfiles([worth], { permalink: CAPABILITY_LINK }).body,
        "4-multi-job.md": renderFromProfiles([install, worth], { permalink: CAPABILITY_LINK }).body,
        "5-updated-commit.md": renderFromProfiles([normal], { permalink: CAPABILITY_LINK }).body,
        "6-partial-coverage.md": renderFromProfiles([worth], { permalink: CAPABILITY_LINK, expectedJobs: 6 }).body,
    }
    for (const [file, body] of Object.entries(expected)) {
        const onDisk = await readFile(join(fixturesDir, "mockups", file), "utf8")
        assert.equal(onDisk, `${body}\n`, `${file} diverges from the vendored renderer`)
    }
})

// buildRunReview is exercised end-to-end above; assert Phase 1 scope directly.
test("Phase 1 scope: review carries lineage + egress only", () => {
    const { review } = renderFromProfiles([worth])
    assert.ok(Array.isArray(review.jobs))
    for (const j of review.jobs) {
        assert.ok(!("files" in j) || !j.files, "files must not render in Phase 1")
        assert.ok(!("assertions" in j) || !j.assertions, "assertions must not render in Phase 1")
    }
    assert.equal(typeof buildRunReview, "function")
    assert.equal(typeof jobSummaryLine, "function")
})
