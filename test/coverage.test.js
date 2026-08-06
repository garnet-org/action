/**
 * Unit gate for the runtime-coverage signal (src/coverage.js): the
 * full/degraded/none classification, the canary-vs-record check, and the
 * incomplete-capture banner rendering.
 *
 *   node --test test/
 */
import test from "node:test"
import assert from "node:assert/strict"
import { assessCoverage, formatRunnerEnvironment, renderCoverageBanner } from "../src/coverage.js"

const DOCS_URL = "https://docs.garnet.ai"

/**
 * Minimal JobRecord factory.
 * @param {{ edges?: object[], totalConnections?: number | null }} [options]
 */
function makeRecord({ edges = [], totalConnections = null } = {}) {
    return {
        name: "test",
        workflow: "CI",
        repository: "garnet-org/action",
        sha: "0000000000000000000000000000000000000000",
        run_id: "1",
        run_url: "",
        job_url: "",
        profile_id: "",
        uuid: "",
        timestamp: "2026-08-06T12:00:00Z",
        ref: "",
        actor: "",
        job_index: "",
        flow_count: edges.length,
        telemetry: { total_domains: null, total_connections: totalConnections },
        assertions: [],
        edges,
    }
}

/**
 * @param {string[]} names
 * @param {string} [address]
 */
function makeEdge(names, address = "") {
    return {
        flow_id: 0,
        tree_index: 0,
        remote_address: address,
        remote_names: names,
        remote_ports: [],
        protocol: "tcp",
        result: "",
        detections: [],
        lineage_recorded: false,
        pid: "",
        process: "",
        ancestry: [],
        github_step: "",
    }
}

const HEALTHY_ENV = { kernel: "6.17.0-1018-azure", btfPresent: true, cgroupV2: true, provider: "github-hosted" }
const NO_BTF_ENV = { kernel: "6.6.141", btfPresent: false, cgroupV2: true, provider: "blacksmith" }

test("no record classifies as none", () => {
    const result = assessCoverage(null, { canaryDomain: "api.garnet.ai", environment: HEALTHY_ENV })
    assert.equal(result.status, "none")
    assert.equal(result.canaryObserved, false)
})

test("record with outbound connections including the canary classifies as full", () => {
    const record = makeRecord({
        edges: [makeEdge(["registry.npmjs.org"], "104.16.0.1"), makeEdge(["API.GARNET.AI"], "34.0.0.1")],
        totalConnections: 40,
    })
    const result = assessCoverage(record, { canaryDomain: "api.garnet.ai", environment: HEALTHY_ENV })
    assert.equal(result.status, "full")
    assert.equal(result.canaryObserved, true)
    assert.equal(result.destinations, 2)
    assert.equal(result.connections, 40)
    assert.deepEqual(result.reasons, [])
})

test("record with zero outbound connections classifies as degraded with kernel context", () => {
    const record = makeRecord()
    const result = assessCoverage(record, { canaryDomain: "api.garnet.ai", environment: NO_BTF_ENV })
    assert.equal(result.status, "degraded")
    assert.ok(result.reasons.some(r => r.includes("zero outbound connections")))
    assert.ok(result.reasons.some(r => r.includes("canary connection to api.garnet.ai")))
    assert.ok(result.reasons.some(r => r.includes("BTF")))
})

test("record with outbound connections but no canary still classifies as full", () => {
    // Other connections were recorded — capture works; the canary may have
    // been deduplicated, resolved to a different name, or raced the collector.
    const record = makeRecord({ edges: [makeEdge(["registry.npmjs.org"], "104.16.0.1")], totalConnections: 12 })
    const result = assessCoverage(record, { canaryDomain: "api.garnet.ai", environment: HEALTHY_ENV })
    assert.equal(result.status, "full")
    assert.equal(result.canaryObserved, false)
})

test("empty canary domain does not cause false degradation when connections exist", () => {
    const record = makeRecord({ edges: [makeEdge(["github.com"], "140.82.0.1")], totalConnections: 3 })
    const result = assessCoverage(record, { canaryDomain: "", environment: HEALTHY_ENV })
    assert.equal(result.status, "full")
})

test("zero connections with no canary and no environment still degrades on totals", () => {
    const record = makeRecord()
    const result = assessCoverage(record, { canaryDomain: "", environment: null })
    assert.equal(result.status, "degraded")
    assert.equal(result.reasons.length, 1)
})

test("canary matches on remote_address when names are empty", () => {
    const record = makeRecord({ edges: [makeEdge([], "104.18.0.1")], totalConnections: 1 })
    const result = assessCoverage(record, { canaryDomain: "104.18.0.1", environment: HEALTHY_ENV })
    assert.equal(result.canaryObserved, true)
    assert.equal(result.status, "full")
})

test("connections fall back to flow_count when telemetry totals are unrecorded", () => {
    const record = makeRecord({ edges: [makeEdge(["github.com"], "140.82.0.1")] })
    const result = assessCoverage(record, { canaryDomain: "", environment: HEALTHY_ENV })
    assert.equal(result.connections, 1)
})

test("banner renders only for degraded status", () => {
    const degraded = assessCoverage(makeRecord(), { canaryDomain: "api.garnet.ai", environment: NO_BTF_ENV })
    const banner = renderCoverageBanner(degraded, NO_BTF_ENV, DOCS_URL)
    assert.ok(banner.startsWith("> [!WARNING]"))
    assert.ok(banner.includes("Incomplete network recording"))
    assert.ok(banner.includes(formatRunnerEnvironment(NO_BTF_ENV)))
    assert.ok(banner.includes(DOCS_URL))
    assert.ok(banner.endsWith("\n\n"))

    const full = assessCoverage(makeRecord({ edges: [makeEdge(["api.garnet.ai"], "34.0.0.1")], totalConnections: 1 }), {
        canaryDomain: "api.garnet.ai",
        environment: HEALTHY_ENV,
    })
    assert.equal(renderCoverageBanner(full, HEALTHY_ENV, DOCS_URL), "")

    const none = assessCoverage(null, { canaryDomain: "api.garnet.ai", environment: HEALTHY_ENV })
    assert.equal(renderCoverageBanner(none, HEALTHY_ENV, DOCS_URL), "")
})

test("banner uses no banned vocabulary", () => {
    const banned = [
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
    ]
    const degraded = assessCoverage(makeRecord(), { canaryDomain: "api.garnet.ai", environment: NO_BTF_ENV })
    const banner = renderCoverageBanner(degraded, NO_BTF_ENV, DOCS_URL)
    for (const term of banned) {
        const re = new RegExp(`\\b${term}\\b`, "i")
        assert.ok(!re.test(banner), `found banned term "${term}"`)
    }
})

test("formatRunnerEnvironment is a single greppable line", () => {
    const line = formatRunnerEnvironment(NO_BTF_ENV)
    assert.equal(line, "kernel=6.6.141 btf=absent cgroup_v2=present provider=blacksmith")
})
