/**
 * Unit gate for the runtime-coverage signal (src/coverage.js): the
 * full/degraded/none classification, the canary-vs-egress check, and the
 * degraded-coverage banner rendering.
 *
 *   node --test test/
 */
import test from "node:test"
import assert from "node:assert/strict"
import { assessCoverage, formatRunnerEnvironment, renderCoverageBanner } from "../src/coverage.js"

const DOCS_URL = "https://docs.garnet.ai"

/** Minimal NormalizedProfile factory. */
function makeProfile({ peers = [], totalDomains = 0, totalConnections = 0 } = {}) {
    return {
        timestamp: "2026-07-23T12:00:00Z",
        github: {},
        assertions: [],
        egress_peers: peers,
        telemetry: { total_domains: totalDomains, total_connections: totalConnections },
        report_link: "",
    }
}

function makePeer(names, address = "") {
    return { remote_names: names, remote_address: address, proc_trees: [], result: "" }
}

const HEALTHY_ENV = { kernel: "6.17.0-1018-azure", btfPresent: true, cgroupV2: true, provider: "github-hosted" }
const NO_BTF_ENV = { kernel: "6.6.141", btfPresent: false, cgroupV2: true, provider: "blacksmith" }

test("no profile classifies as none", () => {
    const result = assessCoverage(null, { canaryDomain: "api.garnet.ai", environment: HEALTHY_ENV })
    assert.equal(result.status, "none")
    assert.equal(result.canaryObserved, false)
})

test("profile with egress including the canary classifies as full", () => {
    const profile = makeProfile({
        peers: [makePeer(["registry.npmjs.org"]), makePeer(["API.GARNET.AI"])],
        totalDomains: 2,
        totalConnections: 40,
    })
    const result = assessCoverage(profile, { canaryDomain: "api.garnet.ai", environment: HEALTHY_ENV })
    assert.equal(result.status, "full")
    assert.equal(result.canaryObserved, true)
    assert.deepEqual(result.reasons, [])
})

test("profile with zero egress classifies as degraded with kernel context", () => {
    const profile = makeProfile({ totalDomains: 0, totalConnections: 0 })
    const result = assessCoverage(profile, { canaryDomain: "api.garnet.ai", environment: NO_BTF_ENV })
    assert.equal(result.status, "degraded")
    assert.ok(result.reasons.some(r => r.includes("zero network egress")))
    assert.ok(result.reasons.some(r => r.includes("canary flow to api.garnet.ai")))
    assert.ok(result.reasons.some(r => r.includes("BTF")))
})

test("profile with egress but no canary still classifies as full", () => {
    // Other flows were captured — capture works; the canary may have been
    // deduplicated, resolved to a different name, or raced the collector.
    const profile = makeProfile({
        peers: [makePeer(["registry.npmjs.org"])],
        totalDomains: 1,
        totalConnections: 12,
    })
    const result = assessCoverage(profile, { canaryDomain: "api.garnet.ai", environment: HEALTHY_ENV })
    assert.equal(result.status, "full")
    assert.equal(result.canaryObserved, false)
})

test("empty canary domain does not cause false degradation when egress exists", () => {
    const profile = makeProfile({ peers: [makePeer(["github.com"])], totalDomains: 1, totalConnections: 3 })
    const result = assessCoverage(profile, { canaryDomain: "", environment: HEALTHY_ENV })
    assert.equal(result.status, "full")
})

test("zero egress with no canary and no environment still degrades on totals", () => {
    const profile = makeProfile({ totalDomains: 0 })
    const result = assessCoverage(profile, { canaryDomain: "", environment: null })
    assert.equal(result.status, "degraded")
    assert.equal(result.reasons.length, 1)
})

test("canary matches on remote_address when names are empty", () => {
    const profile = makeProfile({
        peers: [makePeer([], "104.18.0.1")],
        totalDomains: 0,
        totalConnections: 1,
    })
    const result = assessCoverage(profile, { canaryDomain: "104.18.0.1", environment: HEALTHY_ENV })
    assert.equal(result.canaryObserved, true)
    assert.equal(result.status, "full")
})

test("banner renders only for degraded status", () => {
    const degraded = assessCoverage(makeProfile(), { canaryDomain: "api.garnet.ai", environment: NO_BTF_ENV })
    const banner = renderCoverageBanner(degraded, NO_BTF_ENV, DOCS_URL)
    assert.ok(banner.startsWith("> [!WARNING]"))
    assert.ok(banner.includes("Degraded runtime coverage"))
    assert.ok(banner.includes(formatRunnerEnvironment(NO_BTF_ENV)))
    assert.ok(banner.includes(DOCS_URL))
    assert.ok(banner.endsWith("\n\n"))

    const full = assessCoverage(
        makeProfile({ peers: [makePeer(["api.garnet.ai"])], totalDomains: 1, totalConnections: 1 }),
        { canaryDomain: "api.garnet.ai", environment: HEALTHY_ENV },
    )
    assert.equal(renderCoverageBanner(full, HEALTHY_ENV, DOCS_URL), "")

    const none = assessCoverage(null, { canaryDomain: "api.garnet.ai", environment: HEALTHY_ENV })
    assert.equal(renderCoverageBanner(none, HEALTHY_ENV, DOCS_URL), "")
})

test("formatRunnerEnvironment is a single greppable line", () => {
    const line = formatRunnerEnvironment(NO_BTF_ENV)
    assert.equal(line, "kernel=6.6.141 btf=absent cgroup_v2=present provider=blacksmith")
})
