// Negative-path coverage for the security hardening surfaces: input
// validation before values reach the release download URL or /etc/jibril,
// and record-derived Markdown/HTML link targets.

import assert from "node:assert/strict"
import { test } from "node:test"

import { validateApiURL, validateJibrilVersion, validateNetworkPolicyYAML } from "../src/action.js"
import {
    pullRequestURL,
    safeHTTPURL,
    safeRepositorySlug,
    safeServerURL,
    summarizeProfile,
} from "../src/runtime-review.js"

test("jibril_version validation accepts release shapes", () => {
    for (const version of ["latest", "v2.16.0", "2.16.0", "v0.0", "v2.10.4", "v2.17.0-rc.1"]) {
        assert.equal(validateJibrilVersion(version), version)
    }
})

test("jibril_version validation rejects URL-shaping values", () => {
    const malicious = [
        "../../../attacker/repo/releases/download/v1.0.0",
        "v1.0.0/../../evil",
        "v1.0.0?x=1",
        "v1.0.0#frag",
        "attacker/repo",
        "latest/download/other",
        "",
        "v1.0.0 && curl evil",
    ]
    for (const version of malicious) {
        assert.throws(() => validateJibrilVersion(version), /Invalid jibril_version/, version)
    }
})

test("api_url validation requires https for remote hosts", () => {
    assert.equal(validateApiURL("https://api.garnet.ai"), "https://api.garnet.ai")
    assert.equal(validateApiURL("http://localhost:8080"), "http://localhost:8080")
    assert.equal(validateApiURL("http://127.0.0.1:3000"), "http://127.0.0.1:3000")
    assert.throws(() => validateApiURL("http://evil.example.com"), /must use https/)
    assert.throws(() => validateApiURL("ftp://api.garnet.ai"), /must use https/)
    assert.throws(() => validateApiURL("not a url"), /not a valid URL/)
})

test("network policy validation rejects empty, oversized, and binary content", () => {
    const valid = "network_policy:\n  default_mode: alert\n"
    assert.equal(validateNetworkPolicyYAML(valid), valid)
    assert.throws(() => validateNetworkPolicyYAML(""), /empty/)
    assert.throws(() => validateNetworkPolicyYAML("   \n"), /empty/)
    assert.throws(() => validateNetworkPolicyYAML("a".repeat(1024 * 1024 + 1)), /size bound/)
    assert.throws(() => validateNetworkPolicyYAML("rules:\n\u0000binary"), /control characters/)
})

test("repository slug and server URL sinks fail closed", () => {
    assert.equal(safeRepositorySlug("garnet-org/action"), "garnet-org/action")
    assert.equal(safeRepositorySlug("evil/repo](javascript:alert(1))"), "")
    assert.equal(safeRepositorySlug("a/b/c"), "")
    assert.equal(safeServerURL("https://github.com"), "https://github.com")
    assert.equal(safeServerURL("javascript:alert(1)//"), "")
    assert.equal(safeServerURL("https://evil.com/path?x=1"), "")
    assert.equal(safeHTTPURL("https://github.com/garnet-org/action"), "https://github.com/garnet-org/action")
    assert.equal(safeHTTPURL("javascript:alert(1)"), "")
    assert.equal(safeHTTPURL(""), "")
})

test("forged repository and server_url never reach a rendered link target", () => {
    const summary = summarizeProfile({
        github: {
            job: "test",
            repository: "evil](javascript:alert(1))",
            server_url: "javascript:evil//",
            run_id: "123",
            ref: "refs/pull/7/merge",
        },
    })
    assert.equal(summary.repository, "")
    assert.equal(summary.run_url, "")
    assert.equal(summary.pr_url, "")
    assert.equal(
        pullRequestURL({ ref: "refs/pull/7/merge", repository: "garnet-org/action", server_url: "https://github.com" }),
        "https://github.com/garnet-org/action/pull/7",
    )
})
