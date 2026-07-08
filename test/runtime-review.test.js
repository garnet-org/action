/**
 * Spec gate for the observation-only Garnet Runtime Review renderer
 * (contract v6.1), ported from the locked reference test suite in
 * garnet-org/runtime-review-testbed (`cmd/garnet-runtime-review/review.test.mjs`
 * at tag v6.1.0): the banned-vocabulary/glyph hard gate, the v6.0/v6.1 gate
 * deltas (noun rule, GitHub-CIDR classification, scaffold italics, vocab
 * lock, year-in-stamp, waiting state), acceptance tests 18–27, and
 * byte-comparison against the checked-in real-data goldens.
 *
 * One deliberate delta from the reference (ENG-1355): fold-subtext
 * permalinks are RUN-LEVEL — no `?job=` selector (per-job `?job=` permalinks
 * are the control-plane GitHub App comment's job). The fold-subtext gates
 * below assert the run-level form.
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
    isGithubOwnedIp,
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
    SIZE_BUDGET,
    COMMENT_MARKER,
    RUNTIME_REVIEW_MARKER,
    VOCAB,
} from "../src/runtime-review.js"
import {
    loadProfile,
    renderFromProfiles,
    renderNoRecordState,
    renderCommentStates,
    renderStepSummaryStates,
} from "./fixtures/regenerate.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(here, "fixtures")

/** Pinned render clock so renders stay byte-identical (§1.2 freshness stamp). */
const RENDERED_AT = "2026-07-03T14:02:00Z"

const DOCS_URL = "https://github.com/garnet-org/action#readme"

// ---------------------------------------------------------------------------
// Real inputs — captured from live CI runs of the testbed repo (vendored at
// tag v6.1.0).
// ---------------------------------------------------------------------------
const normal = await loadProfile("normal-run.json") // run 28488074733 — plain npm install
const install = await loadProfile("npm-install-run.json") // run 28488074733 — install + resolver
const worth = await loadProfile("worth-a-look-run.json") // run 28492112239 — unsplash fetch in npm test
// The five REAL recorded jobs of the testbed's own workflow (run 28920090126).
const record = await Promise.all(
    ["workload-egress", "docs-build", "install-only", "lint", "typecheck"].map(j => loadProfile(`record-${j}.json`)),
)
const sample = await loadProfile("sample-profile.json")

const STATES = {
    "no-record": renderNoRecordState("ef01a52517e7532ab34aadea58b952c9f1e79ece"),
    "registry-only": renderFromProfiles([normal]).body,
    "workload-egress": renderFromProfiles([worth]).body,
    "multi-job": renderFromProfiles(record, { expectedJobs: 5 }).body,
    "partial-coverage": renderFromProfiles([worth], { expectedJobs: 6 }).body,
}

// Synthetic jobs used only where no real profile can produce the edge case.
const CANARY_JOB = {
    name: "runtime-review",
    workflow: "Garnet Runtime Review",
    run_id: "1",
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
        appUrl: "https://app.garnet.ai",
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
// ⏳ is allowed: it marks the waiting state ("still being recorded"), not a verdict.
const BANNED_GLYPHS_RE = /[✅🛑🔍🔴⚠]/u

for (const [name, md] of Object.entries({ ...STATES, canary: CANARY })) {
    test(`[${name}] canonical marker first, self-marker second`, () => {
        assert.ok(md.startsWith(RUNTIME_REVIEW_MARKER), "starts with the canonical marker")
        assert.ok(md.includes(COMMENT_MARKER), "carries the self-marker (takeover window)")
    })
    test(`[${name}] anatomy: title + quoted meta line (§1.2)`, () => {
        assert.ok(md.includes("### Garnet Runtime Review"))
        // Coverage fraction appears only when there is a gap (k < n).
        assert.match(
            md,
            /> \*commit \[`[0-9a-f]{7}`\]\(https:\/\/github\.com\/[^)]+\/commit\/[^)]+\)\* · (\*\*\d+ (of \d+ )?jobs? recorded( yet)?\*\* · )?(\*\d+ workflows\* · )?\*(no )?jobs recorded( yet)? as of [A-Z][a-z]{2} \d{1,2} \d{4}, \d{1,2}:\d{2} (AM|PM) UTC\*/,
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
        assert.ok(!/^`garnet-(labs|org)\//m.test(md), "repo name must not lead the meta line (§1.2)")
        // v6.0 removed the inline AI grounding block — the comment stays
        // human-shaped; the structured feed's home is the MCP read endpoint.
        assert.ok(!md.includes("🤖"), "no AI-reviewers fold in the comment")
        assert.ok(!md.includes("```json"), "no inline JSON grounding block")
    })
    test(`[${name}] footer only on coverage gap; thesis lives in the preamble; no relative time`, () => {
        assert.ok(!/What happened in this PR[^·]*\.<\/sub>_$/m.test(md), "the thesis never renders as a footer")
        if (/not yet recorded/.test(md)) {
            assert.match(md, /> <sub>\d+ jobs? not yet recorded — \[add the step ↗\]\(/)
            assert.ok(!/> _<sub>/.test(md), "footer is <sub> only — no italic wrapper")
        } else {
            assert.ok(!/^---$/m.test(md), "complete runs have no footer at all")
        }
        assert.ok(!/\bago\b/.test(md), "the string 'ago' never appears")
    })
}

for (const [name, md] of Object.entries(STATES)) {
    if (name === "no-record") continue
    test(`[${name}] expanded tree is the canonical truth: <pre>, bold workload / italic scaffolding, plain → destinations (§1.6)`, () => {
        assert.ok(md.includes("<pre>"), "trees render as <pre> so processes can be bold")
        assert.ok(!md.includes("````text"), "text fences replaced by the canonical <pre> tree")
        assert.match(md, /^[├└│\s]*[├└]─ <b>[^<]+<\/b>$/m, "workload processes render bold")
        assert.match(md, /^[├└│\s]*[├└]─ <i>systemd<\/i>$/m, "runner scaffolding renders italic")
        assert.match(md, /^[├└│\s]*[├└]─ → [\w.-]+/m, "destinations render plain")
        assert.match(md, /^<i>[\w-]+ · job<\/i>$/m, "the root is plain italic with the job annotation")
        assert.ok(!/┄ \d+ more destination/.test(md), "no focus collapsing in the canonical tree")
    })
    test(`[${name}] fold heading = workflow / linked job name (bold, run href, no run number) + italic true counts ending at domains (§1.5)`, () => {
        assert.match(
            md,
            /<details(?: open)?><summary><b><code>[^<]+<\/code><\/b> \/ <a href="https:\/\/github\.com\/[^"]+\/actions\/runs\/\d+"><b><code>[\w-]+<\/code><\/b> ↗<\/a> — <i>\d+ processes? · contacted \d+ (domains?|destinations?)<\/i><\/summary>/,
        )
        assert.ok(!/<a [^>]*>#?\d+ ↗<\/a>/.test(md), "no standalone run-number link renders anywhere")
        assert.ok(!/<\/i><\/summary>/.test(md.match(/<summary>[^\n]*connection[^\n]*<\/summary>/)?.[0] ?? ""), "heading counts stop at domains")
        assert.ok(!/<summary><b><code>[\w-]+<\/code><\/b> — reached /.test(md), "no destination enumeration in the heading")
    })
    test(`[${name}] fold subtext = only the one garnet permalink (§1.7), on the PUBLIC route, run-level (no ?job= — ENG-1355)`, () => {
        assert.match(
            md,
            /<sub><a href="https:\/\/app\.garnet\.ai\/public\/runs\/\d+\?utm_source=github&amp;utm_medium=pr_comment">View Run Profile in Garnet ↗<\/a><\/sub>/,
        )
        assert.ok(!md.includes("?job="), "the ?job= selector is the GitHub-App comment's job (ENG-1355)")
        assert.ok(!md.includes("/dashboard/runs/"), "the authed dashboard route never renders (§1.1)")
        assert.ok(!md.toLowerCase().includes("paste the tree into your review agent"), "paste cue retired from the subtext")
    })
    test(`[${name}] preamble: thesis doubles as the explainer summary, one quote block, open only on firstRun (§1.3–§1.4)`, () => {
        assert.ok(
            md.includes(
                "<summary><sub><i>What happened on this commit — each job's process tree and where it reached</i> · 💡 how to read this</sub></summary>",
            ),
        )
        assert.ok(
            md.includes(
                "<b>bold</b> = a process the job ran, <i>italic</i> = runner scaffolding, <code>→</code> = destination reached",
            ),
            "explainer body teaches the typography legend verbatim (vocab lock)",
        )
        assert.ok(
            !md.includes("<details open><summary><sub><i>What happened"),
            "explainer collapses when not the first run",
        )
        assert.match(md, /^> \*commit [^\n]+\n>\n> <details/m, "the meta line and explainer share one quote block")
    })
}

test("counts invariant: every fold heading finger-counts against its own rendered tree (§1.5)", () => {
    const foldRe =
        /<details(?: open)?><summary>[^\n]*— <i>(\d+) processes? · contacted (\d+) (?:domains?|destinations?)<\/i><\/summary>([\s\S]*?)<\/details>/g
    let checked = 0
    for (const [name, md] of Object.entries(STATES)) {
        for (const m of md.matchAll(foldRe)) {
            const [, procs, dests, body] = m
            const pre = body.match(/<pre>([\s\S]*?)<\/pre>/)
            if (!pre) continue // collapsed-under-budget folds carry their own marker
            // P counts EVERY process node — bold workload AND italic
            // scaffolding; italic vs bold is pure typography and never
            // changes the count.
            const procNodes = (pre[1].match(/[├└]─ <[bi]>[^<]+<\/[bi]>/g) || []).length
            const leaves = new Set(
                [...pre[1].matchAll(/→ ([^\s<]+)(?: <i>\(([^)]+)\)<\/i>)?/g)]
                    .filter(l => l[2] !== "dns resolver")
                    .map(l => l[1]),
            )
            assert.equal(procNodes, Number(procs), `${name}: process nodes (bold + italic) must equal the heading's process count`)
            assert.equal(leaves.size, Number(dests), `${name}: distinct destination leaves must equal the heading's count`)
            checked += 1
        }
    }
    assert.ok(checked >= 3, "the invariant actually exercised rendered folds")
})

// ---------------------------------------------------------------------------
// A7 — the job name IS the label for its Actions run: every Actions-run link
// wraps the bold job name (` ↗` inside the link); no run-number or separate
// run-link label ever renders. Href derives from run_id (run_url), never
// run_number (§1.5).
// ---------------------------------------------------------------------------
test("A7: run link lives on the job name — every Actions-run link labels a bold job name, never a run number", () => {
    let links = 0
    for (const [name, md] of Object.entries({ ...STATES, canary: CANARY })) {
        for (const m of md.matchAll(/<a href="[^"]*\/actions\/runs\/[^"]*">([\s\S]*?)<\/a>/g)) {
            links += 1
            assert.match(m[1], /^<b><code>[^<]+<\/code><\/b> ↗$/, `${name}: the Actions-run link label must be the bold job name`)
            assert.ok(!/^#?\d+ ↗$/.test(m[1]), `${name}: run-number labels are retired`)
        }
        assert.ok(!/job log ↗/.test(md), `${name}: no separate run-link label renders`)
    }
    assert.ok(links >= 3, "the gate actually exercised rendered Actions-run links")
    // Zero-egress sub-lines and plain (markdown) mode carry the same
    // placement: job name linked, ↗ inside the link; no run_url ⇒ the name
    // renders bare.
    const linked = { name: "j", workflow: "w", run_id: "9", run_url: "https://github.com/x/y/actions/runs/9", connections: [] }
    assert.equal(
        jobSummaryLine(linked, new Set(), { html: true }),
        '<b><code>w</code></b> / <a href="https://github.com/x/y/actions/runs/9"><b><code>j</code></b> ↗</a> — no outbound connections.',
    )
    assert.equal(
        jobSummaryLine(linked, new Set()),
        "**`w`** / [**`j`** ↗](https://github.com/x/y/actions/runs/9) — no outbound connections.",
    )
    assert.equal(
        jobSummaryLine({ ...linked, run_url: "", run_id: "" }, new Set(), { html: true }),
        "<b><code>w</code></b> / <b><code>j</code></b> — no outbound connections.",
    )
})

// ---------------------------------------------------------------------------
// Acceptance tests 18–27.
// ---------------------------------------------------------------------------
test("18: resolver stub renders with its self-describing descriptor; excluded from candidacy, kept in counts", () => {
    assert.match(CANARY, /→ localhost <i>\(dns resolver\)<\/i>/)
    assert.ok(!/→ dns\b/.test(CANARY), "the bare `dns` tag is retired")
    assert.match(CANARY, /<summary><b><code>[^<]+<\/code><\/b> \/ <a[^>]+><b><code>[\w-]+<\/code><\/b> ↗<\/a> — <i>\d+ processes · contacted \d+ (domains?|destinations?)<\/i><\/summary>/)
})
test("19: the sensor's upload keeps its recorded name + descriptor in the canonical tree — no IP", () => {
    assert.match(CANARY, /→ api\.garnet\.ai <i>\(garnet sensor upload\)<\/i>/, "recorded name with self-describing descriptor")
    assert.ok(!CANARY.includes("104.26.11.16"), "the IP drops when a domain exists")
    assert.ok(!CANARY.includes("`api.garnet.ai`"), "garnet upload never headlines or enumerates")
})
test("20: canonical comment tree shows the FULL ancestry; default tree still elides the runner chain", () => {
    // The comment's expanded tree is the canonical truth — the runner chain
    // renders in full, starting from the real root.
    assert.match(CANARY, /└─ <i>systemd<\/i>/, "the real root process renders in the canonical tree (italic scaffolding)")
    assert.ok(!CANARY.includes("GitHub runner ┄"), "no runner-chain compression in the canonical tree")
    // The default (non-canonical) tree keeps the compression for other
    // surfaces — but only for runner-chain egress to GitHub-OWNED destinations.
    const owned = buildRunReview({
        sha: "ac543cb", renderedAt: RENDERED_AT,
        jobs: [{ name: "j", connections: [
            { ancestry: ["systemd", "sudo", "provjobd99"], domain: "github.com", ip: "140.82.114.24" },
        ] }],
    })
    const defaultTree = renderJobTree(owned.jobs[0])
    assert.match(defaultTree, /└─ GitHub runner ┄ \d+ processes(?: · \d+ connections? → GitHub-owned addresses)?/)
    assert.ok(!/^\s*[├└]─ systemd$/m.test(defaultTree), "systemd never renders as its own node when elided")
    // Domainless runner-chain egress to a NON-GitHub address never earns
    // de-emphasis: the canary's provjobd → bare-IP branch renders in full
    // even in the default tree.
    const canaryDefault = renderJobTree(canaryReview().jobs[0])
    assert.ok(canaryDefault.includes("168.63.129.16"), "domainless non-GitHub runner-chain egress renders in full")
    // Cancellation: a runner-chain member reaching an unclassified
    // destination renders that branch in full.
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
    // The comment no longer prints the headline; salience still drives
    // ordering, so assert on the computed headline itself.
    assert.match(
        canaryReview().salience.headline,
        /In `runtime-review`, `dash` spawned `curl`, which reached `httpbin\.org`\./,
    )
})
test("22: fold heading carries true telemetry counts, no derived enumeration", () => {
    // The canary mixes named and unnamed egress (provjobd → 168.63.129.16),
    // so the heading noun widens to destination-first counting: 4 domains +
    // 1 IP.
    assert.match(CANARY, /<b><code>Garnet Runtime Review<\/code><\/b> \/ <a[^>]+><b><code>runtime-review<\/code><\/b> ↗<\/a> — <i>\d+ processes · contacted 5 destinations<\/i>/)
    assert.ok(!/ — reached <code>/.test(CANARY), "the heading never enumerates destinations")
})
test("23: R0 signatures normalize trailing digits; display shows the raw name", () => {
    assert.equal(normalizeIdentifier("provjobd128037216"), "provjobd*")
    const a = behaviorSignature({ ancestry: ["sudo", "provjobd128037216"], domain: "x.com" })
    const b = behaviorSignature({ ancestry: ["sudo", "provjobd131111111"], domain: "x.com" })
    assert.equal(a, b)
})
test("24: link policy — the garnet permalink never targets a github.com/actions URL; omitted when absent", () => {
    assert.ok(!/View Run Profile in Garnet ↗<\/a>[^\n]*github\.com\/[^\n]*\/actions\//.test(CANARY))
    assert.ok(!/<a href="https:\/\/github\.com\/[^"]*\/actions\/[^"]*">View Run Profile in Garnet ↗/.test(CANARY))
    const noCap = renderRunReview(buildRunReview({
        sha: "ac543cb", renderedAt: RENDERED_AT,
        permalink: "https://github.com/garnet-labs/runtime-review-testbed/actions/runs/1",
        jobs: [CANARY_JOB],
    }))
    assert.ok(!/<a href="https:\/\/github\.com[^"]*">View Run Profile in Garnet ↗/.test(noCap), "never mislabels a github URL as the garnet permalink")
})
test("25: timestamps are absolute UTC, self-describing, and carry the year", () => {
    assert.match(CANARY, /jobs recorded as of Jul 3 2026, 2:02 PM UTC/)
    assert.equal(freshnessStamp(new Date(RENDERED_AT)), "jobs recorded as of Jul 3 2026, 2:02 PM UTC")
})
test("26: hostile process name renders inert; byte-identical reruns", () => {
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
test("27: a 500-process profile renders under the size budget with explicit collapse markers (§1.8)", () => {
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
    assert.match(body, /┄ \d+ processes · \d+ connections/, "collapse marker present")
    assert.ok(body.includes("### Garnet Runtime Review"))
    assert.match(body, /<summary><b><code>big-job<\/code><\/b> — <i>/, "job line intact")
})

// ---------------------------------------------------------------------------
// Readability invariants.
// ---------------------------------------------------------------------------
test("no prose above the folds — quoted meta line only, headline dropped", () => {
    assert.ok(!CANARY.includes("all shown below"), "no fold-summary meta-chatter")
    const headline = canaryReview().salience.headline
    assert.ok(!CANARY.includes(headline), "the headline sentence never renders in the comment")
    assert.match(CANARY, /<sub><a href="[^"]+">View Run Profile in Garnet ↗<\/a><\/sub>/, "the single garnet permalink lives inside the fold")
})
test("comment tree is canonical — every branch renders in full; Step Summary keeps full detail", () => {
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
    assert.ok(!/┄ \d+ more destinations?/.test(body), "no off-path compression — the tree is the canonical truth")
    assert.ok(body.includes("cache.example.com") && body.includes("mirror.example.com"), "every real branch enumerates")
    const summary = renderStepSummary([{
        scenarios: { github: { job: "e2e", run_id: "1" } },
        network: { egress: { peers: [
            { remote_names: ["cache.example.com"], proc_trees: [{ ancestry: ["bash", "make", "wget"] }] },
            { remote_names: ["mirror.example.com"], proc_trees: [{ ancestry: ["bash", "make", "wget"] }] },
        ] } },
        telemetry: { network: { egress: { total_domains: 2, total_connections: 2 } } },
    }])
    assert.ok(summary.includes("cache.example.com") && summary.includes("mirror.example.com"), "step summary keeps full detail")
})
test("every job is an identical first-class fold — no quieter-jobs grouping; notable jobs open and sort first (§1.8/§4)", () => {
    const mkJob = (name, dest) => ({
        name,
        connections: [{ ancestry: ["bash", "node"], domain: dest, ip: "9.9.9.9" }],
    })
    const review = buildRunReview({
        sha: "ac543cb", renderedAt: RENDERED_AT,
        jobs: [
            mkJob("alpha", "shared.example.com"),
            mkJob("beta", "shared.example.com"),
            mkJob("gamma", "shared.example.com"),
            mkJob("delta", "shared.example.com"),
            mkJob("epsilon", "shared.example.com"),
            mkJob("zeta", "aaa-unique.example.com"),
        ],
    })
    const body = renderRunReview(review)
    assert.ok(!/quieter job/.test(body), "the quieter-jobs group fold is gone")
    assert.ok(!/more jobs ·/.test(body), "the more-jobs group fold is gone")
    for (const name of ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"]) {
        assert.ok(body.includes(`<b><code>${name}</code></b>`), `${name} renders as its own fold`)
    }
    // zeta reached a destination no other job reached: it opens by default
    // and sorts first; everyone else renders closed, alphabetically.
    assert.match(body, /<details open><summary>[^\n]*<b><code>zeta<\/code><\/b>/)
    const at = name => body.indexOf(`<b><code>${name}</code></b>`)
    assert.ok(at("zeta") < at("alpha") && at("alpha") < at("beta") && at("beta") < at("delta"), "notable first, then alphabetical")
    const openFolds = body.match(/<details open><summary>(?!<sub>💡)/g) || []
    assert.equal(openFolds.length, 1, "only the notable job opens by default")
})
test("§1.1: Run Profile permalink derives from the profile's run_id when not explicit — PUBLIC route, run-level", () => {
    assert.equal(
        derivePermalink("", [{ run_id: "28674550787" }], "https://app.garnet.ai"),
        "https://app.garnet.ai/public/runs/28674550787?utm_source=github&utm_medium=pr_comment",
    )
    assert.equal(
        derivePermalink("https://app.garnet.ai/p/x", [{ run_id: "1" }], "https://app.garnet.ai"),
        "https://app.garnet.ai/p/x",
        "explicit permalink wins",
    )
    assert.equal(derivePermalink("", [{}], "https://app.garnet.ai"), "", "no run_id → omitted")
    // The single garnet permalink lives in each job's fold subtext as HTML,
    // derived from that job's own run_id against the app URL — run-level,
    // no ?job= (ENG-1355).
    const { review } = renderFromProfiles([worth])
    assert.match(
        renderRunReview(review),
        /<sub><a href="https:\/\/app\.garnet\.ai\/public\/runs\/\d+\?utm_source=github&amp;utm_medium=pr_comment">View Run Profile in Garnet ↗<\/a><\/sub>/,
    )
})
test("sensor upload classifies for dev API hosts too", () => {
    assert.equal(classifyConnection({ ancestry: ["node"], domain: "dev-api.garnet.ai", ip: "1.2.3.4" }), "garnet upload")
    assert.equal(classifyConnection({ ancestry: ["node"], domain: "api.garnet.ai", ip: "1.2.3.4" }), "garnet upload")
    assert.equal(classifyConnection({ ancestry: ["node"], domain: "not-garnet.ai", ip: "1.2.3.4" }), "")
})

// ---------------------------------------------------------------------------
// Step Summary (§8): the full-detail tabular report, one per raw profile.
// ---------------------------------------------------------------------------
test("step summary renders the full-detail tabular report in the final spec shape (§8)", () => {
    const summary = renderStepSummary([install, worth])
    const sections = [
        "### Garnet Runtime Summary",
        "#### Workload Summary",
        "#### Network Egress Summary",
        "<summary><strong>Assertions</strong> · beta</summary>",
        "<b>Powered by Garnet</b>",
    ]
    for (const section of sections) {
        assert.equal(summary.split(section).length - 1, 2, `${section} appears once per profile`)
    }
    assert.ok(!summary.includes(COMMENT_MARKER), "markers are PR-comment-only")
    assert.ok(!summary.includes(RUNTIME_REVIEW_MARKER), "markers are PR-comment-only")
    // Network egress is lineage-tree-first, not destination-first.
    assert.ok(summary.includes("| Lineage Tree | Destinations |"), "egress table flips to lineage-tree-first")
    assert.ok(summary.includes("Destinations are grouped by lineage tree."), "egress intro sentence")
    assert.ok(summary.includes("`images.unsplash.com`"), "every destination present, un-elided")
    // Telemetry is a deterministic sentence, not a table.
    assert.match(summary, /Network telemetry observed \d+ unique domains?, \d+ destinations?, and \d+ connections?\./)
    assert.ok(!summary.includes("##### Network Telemetry Summary"), "telemetry table removed")
    // Assertions: beta fold, marker + verbatim enum, evidence sub-fold.
    assert.ok(summary.includes("| Class | Check | Result | Evidence |"), "assertions carry the class/check/result/evidence columns")
    assert.ok(summary.includes("A process contacted an unexpected network domain."), "review-oriented check wording")
    assert.ok(summary.includes("🟡 `ATTENTION`"), "attention keeps marker + verbatim enum")
    assert.ok(summary.includes("<summary>Evidence · A process contacted an unexpected network domain.</summary>"), "evidence sub-fold present")
    assert.ok(summary.includes("| Event Type | Destination | Remote Address | Process | Command |"), "evidence table columns")
    assert.ok(!/assertion\(s\) (passed|failed)/.test(summary), "no verdict headline")
    // Vocab lock: one garnet permalink per run, one label everywhere.
    assert.ok(summary.includes("View Run Profile in Garnet ↗"), "permalink label follows the vocab lock")
    assert.ok(!summary.includes("View full report"), "legacy label retired")
    // The Step Summary permalink is run-level — never ?job= (ENG-1355).
    assert.ok(!summary.includes("?job="), "run-level permalink without ?job=")
})

test("step summary: future assertion enum values render verbatim, never coerced (§8.5)", () => {
    const summary = renderStepSummary([{
        scenarios: { github: { job: "j", run_id: "7" } },
        assertions: [
            { class_id: "Network Egress", assertion_id: "no_bad_egress_domain", result: "warn" },
            { class_id: "Custom", assertion_id: "future_check", result: "escalated" },
        ],
        telemetry: { network: { egress: { total_domains: 0, total_connections: 0 } } },
    }])
    assert.ok(summary.includes("🟡 `WARN`"), "WARN keeps its verbatim enum with the attention marker")
    assert.ok(summary.includes("⚪ `ESCALATED`"), "unknown future enums render verbatim with the neutral marker")
})

// ---------------------------------------------------------------------------
// S5 — partial coverage: k of n + the one growth CTA.
// ---------------------------------------------------------------------------
test("S5: partial coverage renders k/n and the add-the-step growth CTA", () => {
    const md = STATES["partial-coverage"]
    assert.match(md, /· \*\*1 of 6 jobs recorded\*\* ·/)
    assert.match(md, /5 jobs not yet recorded — \[add the step ↗\]\(/)
})

test("S5: unknown coverage (expectedJobs 0) drops the fraction and the CTA", () => {
    const body = renderFromProfiles([normal]).body
    assert.ok(!/jobs? recorded\*\*/.test(body), "no coverage fraction without a known gap")
    assert.ok(!body.includes("not yet recorded — [add the step ↗]"), "unknown coverage suppresses the CTA")
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
    assert.ok(!body.includes("<pre>"), "no trees without lineage")
    assert.ok(!/<details( open)?><summary><b>/.test(body), "no job folds without lineage")
    assert.match(body, /^\*\*`j`\*\* — \*contacted 1 domain\*$/m)
})

// ---------------------------------------------------------------------------
// §3 — classification unit coverage.
// ---------------------------------------------------------------------------
test("§3: classes derive from identity/provenance only", () => {
    assert.equal(classifyConnection({ ancestry: [], domain: "localhost", ip: "127.0.0.53" }), "dns")
    assert.equal(classifyConnection({ ancestry: [], domain: "api.garnet.ai", ip: "1.1.1.1" }), "garnet upload")
    assert.equal(
        classifyConnection({ ancestry: ["systemd", "Runner.Worker"], domain: "github.com", ip: "1.1.1.1" }),
        "github infra",
    )
    // Provenance alone is spoofable: a runner-chain-named process reaching a
    // domainless NON-GitHub destination stays unclassified — ownership AND
    // provenance.
    assert.equal(
        classifyConnection({ ancestry: ["systemd", "sudo", "provjobd12"], domain: "", ip: "168.63.129.16" }),
        "",
    )
    // Ownership alone is not provenance: GitHub-owned destinations reached
    // from user code stay unclassified (enumerable evidence).
    assert.equal(classifyConnection({ ancestry: ["bash", "node"], domain: "github.com", ip: "1.1.1.1" }), "")
    assert.equal(classifyConnection({ ancestry: ["bash"], domain: "httpbin.org", ip: "9.9.9.9" }), "")
    // Anchored matching: prefix-spoofed names never classify as the resolver.
    assert.equal(classifyConnection({ ancestry: ["bash"], domain: "localhost.attacker.com", ip: "9.9.9.9" }), "")
    assert.equal(classifyConnection({ ancestry: ["bash"], domain: "", ip: "127.evil.example" }), "")
})

test("§3: domainless GitHub-CIDR IP from the runner chain classifies github infra (vendored snapshot)", () => {
    assert.ok(isGithubOwnedIp("140.82.113.23"), "GitHub edge IP is in the vendored snapshot")
    assert.ok(isGithubOwnedIp("140.82.116.3"))
    assert.ok(!isGithubOwnedIp("168.63.129.16"), "Azure wireserver is NOT GitHub-owned")
    assert.ok(!isGithubOwnedIp("9.9.9.9"))
    assert.equal(
        classifyConnection({ ancestry: ["systemd", "sudo", "provjobd12"], domain: "", ip: "140.82.113.23" }),
        "github infra",
        "ownership + provenance classifies",
    )
    // Ownership alone is not provenance: the same IP reached from USER code
    // stays unclassified — enumerable evidence.
    assert.equal(
        classifyConnection({ ancestry: ["bash", "node"], domain: "", ip: "140.82.113.23" }),
        "",
        "GitHub-CIDR IP reached from user code stays unclassified",
    )
    // Provenance alone is not ownership: a runner-chain process reaching a
    // non-GitHub bare IP stays unclassified.
    assert.equal(
        classifyConnection({ ancestry: ["systemd", "sudo", "provjobd12"], domain: "", ip: "168.63.129.16" }),
        "",
    )
})

test("size budget holds for many jobs: whole sections omit into one explicit marker (§1.8)", () => {
    const jobs = Array.from({ length: 1200 }, (_, i) => ({
        name: `job-${String(i).padStart(3, "0")}`,
        run_id: String(1000 + i),
        connections: [{ ancestry: ["bash", "node"], domain: `dest-${i}.example.com`, ip: "9.9.9.9" }],
    }))
    const review = buildRunReview({ sha: "ac543cb", renderedAt: RENDERED_AT, jobs })
    const body = renderRunReview(review)
    assert.ok(body.length <= SIZE_BUDGET, `body is ${body.length} chars`)
    assert.match(body, /┄ \d+ jobs over the comment size budget — full detail in each run's Step Summary/)
})

// ---------------------------------------------------------------------------
// Determinism: same profile payload + render clock in → same comment out.
// ---------------------------------------------------------------------------
test("deterministic render: identical bytes across repeated renders", () => {
    for (let i = 0; i < 3; i++) {
        assert.equal(renderFromProfiles(record, { expectedJobs: 5 }).body, STATES["multi-job"])
        assert.equal(renderFromProfiles([worth]).body, STATES["workload-egress"])
    }
})

// ---------------------------------------------------------------------------
// Real-data salience expectations and leaf annotations.
// ---------------------------------------------------------------------------
test("R1: multi-job salience names a within-run-unique, unclassified destination", () => {
    const { review } = renderFromProfiles([install, worth])
    assert.match(review.salience.headline, /In `runtime-review`.* — a destination no other job in this run reached\./)
    assert.ok(!/reached `dns`|reached `api\.garnet\.ai`/.test(review.salience.headline))
})
test("§4: single recorded job with egress renders OPEN — the only evidence is never buried", () => {
    const { review } = renderFromProfiles([normal])
    assert.match(review.salience.headline, /In `runtime-review`, \d+ processes reached 1 domain over 1 connection\./)
    // With exactly one recorded job, "a destination no other job reached" is
    // vacuously true for its unclassified egress — the fold opens.
    assert.match(STATES["registry-only"], /<details open><summary><b><code>/, "lone job with egress opens")
})
test("real leaves render the domain only — the recorded address lives in the Step Summary", () => {
    assert.match(STATES["workload-egress"], /→ images\.unsplash\.com$/m)
    assert.match(STATES["registry-only"], /→ registry\.npmjs\.org$/m)
    assert.ok(!STATES["workload-egress"].includes("146.75.94.208"), "IP drops when a domain exists")
    assert.ok(renderStepSummary([worth]).includes("`images.unsplash.com` (146.75.94.208)"), "the Step Summary keeps domain (address)")
})
test("leaf grouping: same-destination siblings collapse to one deterministic line", () => {
    const ips = ["104.16.0.34", "104.16.1.34", "104.16.2.34", "104.16.3.34", "104.16.4.34"]
    const connections = ips.map(ip => ({ ancestry: ["bash", "node"], domain: "registry.npmjs.org", ip }))
    connections.push({ ancestry: ["bash", "node"], domain: "registry.npmjs.org", ip: ips[0] }) // repeat address
    const review = buildRunReview({ sha: "ac543cb", renderedAt: RENDERED_AT, jobs: [{ name: "j", connections }] })
    const tree = renderJobTree(review.jobs[0])
    const registryLines = tree.split("\n").filter(l => l.includes("registry.npmjs.org"))
    assert.equal(registryLines.length, 1, "repeated same-destination leaves collapse to one line")
    // First-seen address shown, the rest fold to +N addresses; ×N keeps the
    // true connection count (6 connections across 5 unique addresses).
    assert.match(tree, /→ registry\.npmjs\.org · 104\.16\.0\.34 \+4 addresses ×6/)
})

// ---------------------------------------------------------------------------
// Zero-counted-egress quiet line (A8) — heading count edge cases:
// destination-first counting, never "0 domains".
// ---------------------------------------------------------------------------
test("A8: IP-only egress reads N destinations, never 0 domains", () => {
    const r = buildRunReview({
        sha: "ac543cb", renderedAt: RENDERED_AT,
        jobs: [{ name: "j", workflow: "w", run_id: "9", run_url: "https://github.com/x/y/actions/runs/9",
            connections: [{ ancestry: ["a", "b"], domain: "", ip: "198.51.100.5" }] }],
    })
    const line = jobSummaryLine(r.jobs[0], r.uniqueDests, { html: true })
    assert.match(line, /contacted 1 destination</)
    assert.ok(!/0 domains/.test(line))
})
test("A8: fully named egress keeps the domains noun; the resolver stub never shifts it", () => {
    const r = buildRunReview({
        sha: "ac543cb", renderedAt: RENDERED_AT,
        jobs: [{ name: "j", workflow: "w", run_id: "9", run_url: "https://github.com/x/y/actions/runs/9",
            connections: [
                { ancestry: ["a", "b"], domain: "github.com", ip: "140.82.116.3" },
                { ancestry: ["a", "b"], domain: "localhost", ip: "127.0.0.53" },
            ] }],
    })
    const line = jobSummaryLine(r.jobs[0], r.uniqueDests, { html: true })
    assert.match(line, /contacted 1 domain</, "resolver stub never shifts the noun")
})
test("A8: resolver-stub-only job reads the quiet line, never a fold", () => {
    const r = buildRunReview({
        sha: "ac543cb", renderedAt: RENDERED_AT,
        jobs: [
            { name: "stub-only", workflow: "w", run_id: "9", run_url: "https://github.com/x/y/actions/runs/9",
                connections: [{ ancestry: ["a", "b"], domain: "localhost", ip: "127.0.0.53" }] },
            { name: "egress", workflow: "w", run_id: "9", run_url: "https://github.com/x/y/actions/runs/9",
                connections: [{ ancestry: ["a", "b"], domain: "github.com", ip: "140.82.116.3" }] },
        ],
    })
    const stub = r.jobs.find(j => j.name === "stub-only")
    assert.equal(
        jobSummaryLine(stub, r.uniqueDests, { html: true }),
        '<b><code>w</code></b> / <a href="https://github.com/x/y/actions/runs/9"><b><code>stub-only</code></b> ↗</a> — no outbound connections.',
    )
    const body = renderRunReview(r)
    assert.ok(!/0 domains/.test(body), "never `0 domains`")
    assert.match(
        body,
        /<sub><b><code>w<\/code><\/b> \/ <a[^>]+><b><code>stub-only<\/code><\/b> ↗<\/a> — no outbound connections\.<\/sub>/,
        "the stub-only job is a quiet subordinate line",
    )
    assert.ok(
        !/<details[^>]*><summary>[^\n]*stub-only/.test(body),
        "a `no outbound connections` row never sits atop a fold",
    )
})
test("A8: a domainless, addressless record still counts as a destination", () => {
    const r = buildRunReview({
        sha: "ac543cb", renderedAt: RENDERED_AT,
        jobs: [{ name: "j", workflow: "w", run_id: "9", run_url: "https://github.com/x/y/actions/runs/9",
            connections: [{ ancestry: ["a", "b"], domain: "", ip: "" }] }],
    })
    const line = jobSummaryLine(r.jobs[0], r.uniqueDests, { html: true })
    assert.match(line, /contacted 1 destination</, "real egress never reads as zero-egress")
    assert.ok(!/no outbound connections/.test(line))
})

// ---------------------------------------------------------------------------
// Waiting state (§2): no coverage fraction — one italic phrase carries the
// fact and the stamp; explainer open; diagnostics sub line; docs footer.
// ---------------------------------------------------------------------------
test("waiting state: meta variant, open explainer, diagnostics line, docs footer (§2)", () => {
    const md = STATES["no-record"]
    assert.match(md, /> \*commit [^\n]+\* · \*no jobs recorded yet as of [A-Z][a-z]{2} \d{1,2} \d{4}, \d{1,2}:\d{2} (AM|PM) UTC\*/)
    assert.ok(!/\*\*0 of \d+/.test(md), "never a 0-of-n fraction — it reads as a score")
    assert.ok(md.includes("<details open><summary><sub><i>What happened on this commit"), "explainer opens through the first-commit lifecycle")
    assert.ok(md.includes("⏳ Run Profiles for this commit are still being recorded — this comment updates in place as jobs finish."))
    assert.ok(md.includes("<sub>Run already finished? Look in the job log for the Garnet step — the sensor must start before the workload runs.</sub>"))
    assert.match(md, /> <sub>1 job not yet recorded — \[add the step ↗\]\(/)
})

// ---------------------------------------------------------------------------
// Typography neutrality — italic scaffolding is PURE de-emphasis: it never
// changes counts, ordering, or notability (§1.6).
// ---------------------------------------------------------------------------
test("italic scaffolding is typographic only: counts, ordering, notability identical either way", () => {
    const mk = ancestry => ({
        sha: "ac543cb", renderedAt: RENDERED_AT,
        jobs: [{ name: "j", connections: [{ ancestry, domain: "httpbin.org", ip: "9.9.9.9" }] }],
    })
    // A process NAMED like a runner-chain member but outside the real chain
    // gets italic at most — every derived fact is identical.
    const real = buildRunReview(mk(["systemd", "hosted-compute-agent", "Runner.Listener", "Runner.Worker", "bash", "curl"]))
    const spoof = buildRunReview(mk(["bash", "Runner.Worker", "curl"]))
    for (const review of [real, spoof]) {
        const line = jobSummaryLine(review.jobs[0], review.uniqueDests, { html: true })
        const m = line.match(/<i>(\d+) processes? ·/)
        assert.ok(m, "heading carries a process count")
        assert.equal(Number(m[1]), review.jobs[0].connections[0].ancestry.length, "P = every process node, italic or bold")
    }
    const body = renderRunReview(real)
    assert.match(body, /<i>systemd<\/i>/, "real chain members render italic")
    assert.match(body, /<b>curl<\/b>/, "workload renders bold")
    const spoofBody = renderRunReview(spoof)
    assert.ok(spoofBody.includes("httpbin.org"), "spoofed name changes nothing but typography")
    assert.match(body, /<details open>/, "notability unaffected by italics (single job with egress opens)")
    assert.match(spoofBody, /<details open>/)
})

// ---------------------------------------------------------------------------
// Noun rule against the REAL recorded profiles: a bare-IP leaf widens the
// heading noun to destinations; all-named jobs keep domains (§1.5).
// ---------------------------------------------------------------------------
test("noun rule on real record profiles: bare IP ⇒ destinations, all-named ⇒ domains", () => {
    const md = STATES["multi-job"]
    assert.match(md, /<b><code>workload-egress<\/code><\/b> ↗<\/a> — <i>\d+ processes · contacted \d+ destinations<\/i>/, "bare 140.82.x IP leaf widens the noun")
    assert.match(md, /<b><code>lint<\/code><\/b> ↗<\/a> — <i>\d+ processes · contacted \d+ destinations?<\/i>/)
    assert.ok(!/contacted \d+ domains?<\/i>[^\n]*140\.82\./.test(md), "never `domains` over a bare-IP leaf")
})

// ---------------------------------------------------------------------------
// summarizeProfile over real captured profiles.
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
// Vocab lock (§1.1): VOCAB strings render verbatim on both surfaces; the
// permalink label is the ONLY garnet-link label.
// ---------------------------------------------------------------------------
test("vocab lock: VOCAB strings render verbatim on both surfaces", () => {
    const comment = renderFromProfiles([worth], { permalink: "https://app.garnet.ai/p/runtime-review-testbed" }).body
    const summary = renderStepSummary([worth])
    assert.ok(comment.includes(`\n### ${VOCAB.prCommentHeading}\n`), "PR comment heading is exactly ###")
    assert.ok(summary.includes(`### ${VOCAB.stepSummaryHeading}`), "Step Summary heading")
    assert.ok(comment.includes(VOCAB.permalinkLabel), "comment permalink label")
    assert.ok(summary.includes(VOCAB.permalinkLabel), "summary permalink label")
    assert.ok(comment.includes(VOCAB.artifact), "artifact name in comment")
    // The permalink label is the ONLY garnet-link label: one per job/run.
    const garnetLinks = comment.match(/<a href="https:\/\/app\.garnet\.ai[^"]*">/g) || []
    const labelled = comment.split(`">${VOCAB.permalinkLabel}</a>`).length - 1
    assert.equal(garnetLinks.length, labelled, "every garnet link carries the locked label")
})

// ---------------------------------------------------------------------------
// Golden fixtures stay in sync with the vendored renderer (regenerate with
// `node test/fixtures/regenerate.mjs`).
// ---------------------------------------------------------------------------
test("fixtures/mockups/*.md match fresh renders byte-for-byte", async () => {
    const expected = await renderCommentStates()
    for (const [file, body] of Object.entries(expected)) {
        const onDisk = await readFile(join(fixturesDir, "mockups", file), "utf8")
        assert.equal(onDisk, `${body}\n`, `${file} is stale — rerun test/fixtures/regenerate.mjs`)
    }
})

test("fixtures/step-summary/*.md match fresh renders byte-for-byte", async () => {
    const expected = await renderStepSummaryStates()
    for (const [file, body] of Object.entries(expected)) {
        const onDisk = await readFile(join(fixturesDir, "step-summary", file), "utf8")
        assert.equal(onDisk, `${body}\n`, `${file} is stale — rerun test/fixtures/regenerate.mjs`)
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
