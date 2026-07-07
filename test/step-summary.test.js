/**
 * The Step Summary renders the tabular Garnet Runtime Report from a
 * normalized profile: workload table, egress table, telemetry counts and
 * assertions — observation-only (no verdict headline, no status column).
 */
import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { parseProfileJson } from "../src/profile-comment.js"
import { renderProfileStepSummary } from "../src/step-summary.js"

const here = dirname(fileURLToPath(import.meta.url))
const fixturesDir = join(here, "fixtures")

async function loadProfile(name) {
    const raw = JSON.parse(await readFile(join(fixturesDir, "profiles", name), "utf8"))
    return parseProfileJson(JSON.stringify({ timestamp: "2026-07-03T14:02:00Z", ...raw }))
}

const profile = await loadProfile("sample-profile.json")
const summary = renderProfileStepSummary(profile)

test("step summary: renders all report sections", () => {
    assert.ok(summary.startsWith("### Garnet Runtime Report"))
    assert.ok(summary.includes("#### Workload Summary"))
    assert.ok(summary.includes("#### Network Egress Summary"))
    assert.ok(summary.includes("##### Network Telemetry Summary"))
    assert.ok(summary.includes("#### Assertions"))
    assert.ok(summary.includes("<b>Powered by Garnet</b>"))
})

test("step summary: workload table carries the GitHub scenario", () => {
    assert.ok(summary.includes(`| Workflow | ${profile.github.workflow} |`))
    assert.ok(summary.includes(`| Repository | ${profile.github.repository} |`))
    assert.ok(summary.includes(`| Commit | ${profile.github.sha} |`))
    assert.ok(summary.includes(`| Run ID / Job | ${profile.github.run_id} / ${profile.github.job} |`))
})

test("step summary: egress table lists destinations with process trees and no status column", () => {
    assert.ok(summary.includes("| Destination | Process Tree |"))
    const firstName = profile.egress_peers[0].remote_names[0]
    assert.ok(summary.includes(`| \`${firstName}\` |`))
    assert.ok(summary.includes("`systemd` → `python3.10`"))
    assert.ok(!summary.includes("| Status |"))
})

test("step summary: telemetry counts stay raw-true", () => {
    assert.ok(summary.includes(`| Total egress unique domain(s) | ${profile.telemetry.total_domains} |`))
    assert.ok(summary.includes(`| Total egress connection(s) | ${profile.telemetry.total_connections} |`))
    const totalNames = profile.egress_peers.reduce((n, peer) => n + peer.remote_names.length, 0)
    assert.ok(summary.includes(`| Total egress destination(s) | ${totalNames} |`))
    assert.ok(summary.includes(`| Total egress flow(s) | ${profile.egress_peers.length} |`))
})

test("step summary: assertions listed as plain results without verdict framing", () => {
    assert.ok(summary.includes("| Assertion | Result |"))
    for (const assertion of profile.assertions) {
        assert.ok(summary.includes(`| \`${assertion.id}\` | ${assertion.result} |`))
    }
    assert.ok(!summary.includes("✅"))
    assert.ok(!summary.includes("🔴"))
    assert.ok(!summary.includes("assertion(s) passed"))
    assert.ok(!summary.includes("assertion(s) failed"))
})

test("step summary: footer carries telemetry, run identity, timestamp and report link", () => {
    assert.ok(
        summary.includes(
            `${profile.telemetry.total_domains} unique domains · ${profile.telemetry.total_connections} connections`,
        ),
    )
    assert.ok(summary.includes(`timestamp ${profile.timestamp}`))
    assert.ok(summary.includes("View full report ↗"))
})

test("step summary: no network data renders placeholders instead of tables", () => {
    const quiet = {
        ...profile,
        assertions: [],
        egress_peers: [],
        telemetry: { total_domains: 0, total_connections: 0 },
    }
    const quietSummary = renderProfileStepSummary(quiet)
    assert.ok(quietSummary.includes("No network information available."))
    assert.ok(quietSummary.includes("No assertions information available."))
})
