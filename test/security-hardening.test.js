// Negative-path coverage for the security hardening surfaces: input
// validation before values reach the release download URL or /etc/jibril,
// untrusted comment-state authors, and record-derived Markdown/HTML link
// targets.

import assert from "node:assert/strict"
import { test } from "node:test"
import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { validateApiURL, validateJibrilVersion, validateNetworkPolicyYAML } from "../src/action.js"
import { mergeCommentState, parseProfileJson, renderCommentBody } from "../src/profile-comment.js"
import { planPullRequestComment } from "../src/pr-comment-plan.js"
import {
    CONTROL_PLANE_MARKERS,
    pullRequestURL,
    safeHTTPURL,
    safeRepositorySlug,
    safeServerURL,
    summarizeProfile,
} from "../src/runtime-review.js"

const here = dirname(fileURLToPath(import.meta.url))
const worthRaw = await readFile(join(here, "fixtures", "profiles", "worth-a-look-run.json"), "utf8")
const worth = parseProfileJson(worthRaw)

function stateBodyFor(profile) {
    const merged = mergeCommentState(null, profile, 1)
    assert.equal(merged.kind, "updated")
    return renderCommentBody(merged.state)
}

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

test("comment state from a non-bot author is ignored", () => {
    const body = stateBodyFor(worth)
    const forged = [{ id: 1, body, authorLogin: "attacker", authorType: "User" }]
    const plan = planPullRequestComment(forged, worth, 2)
    assert.equal(plan.kind, "create")
})

test("comment state from a bot author is honored", () => {
    const body = stateBodyFor(worth)
    const trusted = [{ id: 1, body, authorLogin: "github-actions[bot]", authorType: "Bot" }]
    const plan = planPullRequestComment(trusted, worth, 2)
    assert.equal(plan.kind, "update")
})

test("a control-plane marker pasted by a human does not suppress publication", () => {
    const comments = [
        {
            id: 1,
            body: `<!-- ${CONTROL_PLANE_MARKERS[0]} -->\nforged CP comment`,
            authorLogin: "attacker",
            authorType: "User",
        },
    ]
    const plan = planPullRequestComment(comments, worth, 1)
    assert.equal(plan.kind, "create")
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
