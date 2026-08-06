/**
 * Spec gate for the Garnet execution renderer (contract v6.6.1), locked
 * against the reference goldens from garnet-org/runtime-review-testbed
 * (checked in under fixtures/goldens/, rendered from the captured real
 * profiles under fixtures/profiles/).
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
    renderNoRecordSummary,
    renderJobTree,
    summarizeProfile,
    profilePermalink,
    jobPermalink,
    defangHostname,
    partitionCommentEdges,
    addressNameMap,
    destinationIdentity,
    lintRenderedSurface,
    edgeCounts,
    SIZE_BUDGET,
    STEP_SUMMARY_BUDGET,
    VOCAB,
    COMMENT_MARKER,
    RUNTIME_REVIEW_MARKER,
} from "../src/runtime-review.js"

const here = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(here, "fixtures")

const REPO = "garnet-org/runtime-review-testbed"
const APP_URL = "https://app.garnet.ai"

/** Envelope Profile.IDs captured alongside the real profiles. */
const envelopes = JSON.parse(await readFile(join(fixturesDir, "profiles", "profile-envelopes.json"), "utf8"))

/**
 * Load a captured profile, wrapped in its control-plane envelope when the
 * capture recorded one (the shape the app's profile download returns).
 * @param {string} name
 */
async function loadProfile(name) {
    const data = JSON.parse(await readFile(join(fixturesDir, "profiles", name), "utf8"))
    const id = envelopes[name]?.id
    return typeof id === "string" && id !== "" ? { id, data } : data
}

/** @param {string} name */
async function loadGolden(name) {
    return readFile(join(fixturesDir, "goldens", name), "utf8")
}

/** Render one or more real profiles through the exact CI code path. */
function reviewFor(jobs) {
    const sha = jobs[0]?.sha || ""
    return buildRunReview({
        repo: REPO,
        sha,
        commitURL: sha !== "" ? `https://github.com/${REPO}/commit/${sha}` : "",
        appURL: APP_URL,
        jobs,
    })
}

// ---------------------------------------------------------------------------
// Real inputs — captured from live CI runs of the testbed repo.
// ---------------------------------------------------------------------------
const normal = await loadProfile("normal-run.json")
const worth = await loadProfile("worth-a-look-run.json")
const multiJobProfiles = await Promise.all(
    [
        "record-workload-egress.json",
        "record-docs-build.json",
        "record-install-only.json",
        "record-lint.json",
        "record-typecheck.json",
    ].map(loadProfile),
)

const STATES = {
    "registry-only": [normal].map(summarizeProfile),
    "workload-egress": [worth].map(summarizeProfile),
    "multi-job": multiJobProfiles.map(summarizeProfile),
}

// ---------------------------------------------------------------------------
// Byte parity with the reference goldens — PR comment and Step Summary.
// ---------------------------------------------------------------------------
for (const [name, jobs] of Object.entries(STATES)) {
    test(`[${name}] PR comment matches the reference golden byte-for-byte`, async () => {
        const body = renderRunReview(reviewFor(jobs)) + "\n"
        assert.equal(body, await loadGolden(`${name}.pr-comment.md`))
    })
    test(`[${name}] Step Summary matches the reference golden byte-for-byte`, async () => {
        const summary = renderStepSummary(jobs, { appURL: APP_URL }) + "\n"
        assert.equal(summary, await loadGolden(`${name}.step-summary.md`))
    })
}

// ---------------------------------------------------------------------------
// Contract vocabulary — v6.6.1 hard gate on every rendered surface.
// ---------------------------------------------------------------------------
const BANNED_TERMS = [
    "process chain",
    "baseline",
    "lineage",
    "trace",
    "Run Profile",
    "Runtime Review",
    "Runtime Summary",
    "safe",
    "secure",
    "malicious",
    "threat",
    "verdict",
    "monitoring",
    "clean",
    "score",
    "detected",
    "flagged",
    "as of",
    "github infra",
    "garnet sensor upload",
    "expected plumbing",
]

const SURFACES = {}
for (const [name, jobs] of Object.entries(STATES)) {
    SURFACES[`${name} pr-comment`] = { surface: renderRunReview(reviewFor(jobs)), jobs }
    SURFACES[`${name} step-summary`] = { surface: renderStepSummary(jobs, { appURL: APP_URL }), jobs }
}
SURFACES["no-record step-summary"] = { surface: renderNoRecordSummary(), jobs: [] }

for (const [name, { surface, jobs }] of Object.entries(SURFACES)) {
    test(`[${name}] no banned vocabulary in visible copy`, () => {
        // Recorded data (the captured workflow name) is evidence, not copy;
        // only the renderer's own words are gated.
        let visible = surface.replace(/<!--[\s\S]*?-->/g, "")
        for (const job of jobs) {
            if (job.workflow !== "") {
                visible = visible.replaceAll(job.workflow, "")
            }
        }
        for (const term of BANNED_TERMS) {
            const re = new RegExp(`\\b${term}\\b`, "i")
            assert.ok(!re.test(visible), `found banned term "${term}"`)
        }
    })
    test(`[${name}] link targets stay on garnet.ai / github.com`, () => {
        for (const match of surface.matchAll(/\]\((https?:\/\/[^)]+)\)/g)) {
            const host = new URL(match[1]).host
            assert.ok(
                host === "github.com" || host === "garnet.ai" || host.endsWith(".garnet.ai"),
                `link target ${match[1]} is off-policy`,
            )
        }
    })
    test(`[${name}] semantic surface linter is clean`, () => {
        const kind = name.endsWith("step-summary") ? "step-summary" : "pr"
        assert.deepEqual(lintRenderedSurface(surface, kind), [])
    })
}

test("PR comment carries the markers first and the v6.6.1 headline", () => {
    const body = renderRunReview(reviewFor(STATES["workload-egress"]))
    assert.ok(body.startsWith(`${RUNTIME_REVIEW_MARKER}\n${COMMENT_MARKER}\n`))
    assert.ok(body.includes(VOCAB.headlineLead))
})

test("Step Summary heading is the Garnet Execution Summary", () => {
    const summary = renderStepSummary(STATES["registry-only"], { appURL: APP_URL })
    assert.ok(summary.includes(`## ${VOCAB.stepSummaryHeading}`))
    assert.equal(VOCAB.stepSummaryHeading, "Garnet Execution Summary")
})

test("no-record Step Summary says so plainly, with no substitute clock", () => {
    const summary = renderNoRecordSummary()
    assert.ok(summary.includes(`## ${VOCAB.stepSummaryHeading}`))
    assert.ok(summary.includes(VOCAB.noRunProfile))
    assert.ok(!/\d{2}:\d{2} UTC/.test(summary), "no clock in the no-record summary")
})

// ---------------------------------------------------------------------------
// Permalinks — canonical exact selector, honest fallback, distinct UTM.
// ---------------------------------------------------------------------------
test("envelope-wrapped profile keeps the envelope Profile.ID", () => {
    const job = summarizeProfile(worth)
    assert.equal(job.profile_id, envelopes["worth-a-look-run.json"].id)
})

test("bare profile (no envelope) has no profile_id and never fabricates one", async () => {
    const raw = JSON.parse(await readFile(join(fixturesDir, "profiles", "sample-profile.json"), "utf8"))
    const job = summarizeProfile(raw)
    assert.equal(job.profile_id, "")
    assert.equal(profilePermalink(job, APP_URL, "pr_comment"), "")
})

test("canonical permalink: /public/runs/<run-id>?profile=<profile-id>", () => {
    const job = summarizeProfile(worth)
    assert.equal(
        profilePermalink(job, APP_URL, "pr_comment"),
        `${APP_URL}/public/runs/${job.run_id}?profile=${job.profile_id}&utm_source=github&utm_medium=pr_comment`,
    )
})

test("fallback permalink: /dashboard/runs/<run-id> when the envelope ID is unknown", () => {
    const job = { run_id: "28492112239", profile_id: "" }
    assert.equal(
        jobPermalink(job, APP_URL, "step_summary"),
        `${APP_URL}/dashboard/runs/28492112239?utm_source=github&utm_medium=step_summary`,
    )
    assert.equal(jobPermalink({ run_id: "", profile_id: "" }, APP_URL, "step_summary"), "")
})

test("UTM media are distinct per surface: pr_comment vs step_summary", () => {
    const jobs = STATES["workload-egress"]
    const comment = renderRunReview(reviewFor(jobs))
    const summary = renderStepSummary(jobs, { appURL: APP_URL })
    assert.ok(comment.includes("utm_medium=pr_comment"))
    assert.ok(!comment.includes("utm_medium=step_summary"))
    assert.ok(summary.includes("utm_medium=step_summary"))
    assert.ok(!summary.includes("utm_medium=pr_comment"))
})

// ---------------------------------------------------------------------------
// Hostname defanging — final dot only, address literals unchanged.
// ---------------------------------------------------------------------------
test("defangHostname breaks the final dot of ordinary hostnames only", () => {
    assert.equal(defangHostname("registry.npmjs.org"), "registry.npmjs[.]org")
    assert.equal(defangHostname("github.com"), "github[.]com")
    assert.equal(defangHostname("140.82.116.3"), "140.82.116.3")
    assert.equal(defangHostname("localhost"), "localhost")
})

test("PR comment defangs recorded hostnames", () => {
    const body = renderRunReview(reviewFor(STATES["registry-only"]))
    assert.ok(body.includes("registry.npmjs[.]org"))
})

// ---------------------------------------------------------------------------
// Structure invariants.
// ---------------------------------------------------------------------------
test("edge counts reconcile with the recorded edges", () => {
    for (const [name, jobs] of Object.entries(STATES)) {
        for (const job of jobs) {
            const counts = edgeCounts(job.edges, job.flow_count)
            assert.equal(counts.associations, job.edges.length, `${name}/${job.name}: associations`)
            assert.ok(counts.destinations >= 1, `${name}/${job.name}: at least one destination`)
            assert.equal(counts.flows, job.flow_count, `${name}/${job.name}: flows pin to the sensor count`)
        }
    }
})

test("the comment partition keeps every destination identity visible", () => {
    for (const jobs of Object.values(STATES)) {
        for (const job of jobs) {
            const { shown, substrate } = partitionCommentEdges(job.edges)
            const names = addressNameMap(job.edges)
            const rendered = new Set([...shown, ...substrate].map(edge => destinationIdentity(edge, names)))
            for (const edge of job.edges) {
                assert.ok(rendered.has(destinationIdentity(edge, names)), `identity of ${edge.remote_address} dropped`)
            }
        }
    }
})

test("hostile process names render inert; reruns are byte-identical", () => {
    const hostile = summarizeProfile(worth)
    hostile.edges[0].ancestry = ["bash", "```](https://x.com)\u0007"]
    const review = reviewFor([hostile])
    const one = renderRunReview(review)
    const two = renderRunReview(review)
    assert.equal(one, two, "byte-identical across reruns")
    assert.ok(!one.includes("\u0007"), "control characters stripped")
    assert.ok(!/```\]/.test(one), "backtick run neutralized")
})

test("large profiles stay under the size budgets", () => {
    const job = summarizeProfile(worth)
    const big = {
        ...job,
        edges: Array.from({ length: 500 }, (_, i) => ({
            ...job.edges[0],
            flow_id: i,
            remote_names: [`long-destination-hostname-${i}.example-service.example.com`],
            remote_address: `10.0.${Math.floor(i / 250)}.${i % 250}`,
        })),
        flow_count: 500,
    }
    const body = renderRunReview(reviewFor([big]))
    assert.ok(body.length <= SIZE_BUDGET, `PR comment is ${body.length} chars (budget ${SIZE_BUDGET})`)
    const summary = renderStepSummary([big], { appURL: APP_URL })
    assert.ok(summary.length <= STEP_SUMMARY_BUDGET, `Step Summary is ${summary.length} chars`)
})

test("renderJobTree keeps every recorded chain of the job", () => {
    const job = summarizeProfile(worth)
    const tree = renderJobTree(job)
    for (const edge of job.edges) {
        const name = edge.remote_names[0] ?? edge.remote_address
        if (name !== "") {
            assert.ok(tree.includes(defangHostname(name)) || tree.includes(name), `tree misses ${name}`)
        }
    }
})
