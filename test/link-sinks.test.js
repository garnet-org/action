import assert from "node:assert/strict"
import test from "node:test"

import {
    buildRunReview,
    isSafeRepository,
    pullRequestURL,
    renderRunReview,
    safeLinkTarget,
    safeServerURL,
    summarizeProfile,
} from "../src/runtime-review.js"

test("repository slugs are accepted only in owner/name shape", () => {
    assert.equal(isSafeRepository("garnet-org/action"), true)
    assert.equal(isSafeRepository("owner/name.with.dots"), true)

    for (const value of [
        "",
        "owner",
        "owner/name/extra",
        "owner/name)](javascript:alert(1)",
        "owner/na me",
        "../../etc",
        "owner/name?x=1",
        "owner/<script>",
    ]) {
        assert.equal(isSafeRepository(value), false, value)
    }
})

test("only absolute https targets free of syntax-breaking characters are linkable", () => {
    assert.equal(safeLinkTarget("https://github.com/o/n/commit/abc"), "https://github.com/o/n/commit/abc")
    assert.equal(safeLinkTarget("https://app.garnet.ai/p/1?src=pr_comment"), "https://app.garnet.ai/p/1?src=pr_comment")

    for (const value of [
        "",
        "javascript:alert(1)",
        "JavaScript:alert(1)",
        "http://github.com/o/n",
        "data:text/html;base64,PHN2Zz4=",
        "/relative/path",
        "https://",
        "https://example.com/a) [pwn](javascript:alert(1)",
        'https://example.com/" onmouseover="alert(1)',
        "https://example.com/a b",
    ]) {
        assert.equal(safeLinkTarget(value), "", value)
    }
})

test("an unrecorded server falls back to github.com and a hostile one is dropped", () => {
    assert.equal(safeServerURL(""), "https://github.com")
    assert.equal(safeServerURL("https://ghe.example.com/"), "https://ghe.example.com")
    assert.equal(safeServerURL("javascript:alert(1)"), "")
    assert.equal(safeServerURL("http://evil.example.com"), "")
})

test("a hostile repository or server never reaches the pull request URL", () => {
    assert.equal(
        pullRequestURL({ ref: "refs/pull/7/merge", repository: "garnet-org/action" }),
        "https://github.com/garnet-org/action/pull/7",
    )
    assert.equal(pullRequestURL({ ref: "refs/pull/7/merge", repository: "o/n)](javascript:alert(1)" }), "")
    assert.equal(
        pullRequestURL({ ref: "refs/pull/7/merge", repository: "o/n", server_url: "javascript:alert(1)" }),
        "",
    )
    assert.equal(pullRequestURL({ ref: "refs/heads/main", repository: "o/n" }), "")
})

/**
 * @param {Record<string, unknown>} github
 */
function profileWith(github) {
    return {
        data: {
            uuid: "u-1",
            timestamp: "2026-01-01T00:00:00Z",
            scenarios: { github },
            network: { egress: { peers: [] } },
        },
    }
}

test("a hostile repository or server never reaches the run URL", () => {
    const hostile = summarizeProfile(
        profileWith({
            job: "build",
            workflow: "ci",
            repository: "o/n)](javascript:alert(1)",
            run_id: "42",
        }),
    )
    assert.notEqual(hostile, null)
    assert.equal(hostile?.run_url, "")

    const injectedServer = summarizeProfile(
        profileWith({
            job: "build",
            workflow: "ci",
            repository: "o/n",
            run_id: "42",
            server_url: "javascript:alert(1)",
        }),
    )
    assert.equal(injectedServer?.run_url, "")

    const clean = summarizeProfile(
        profileWith({ job: "build", workflow: "ci", repository: "o/n", run_id: "42" }),
    )
    assert.equal(clean?.run_url, "https://github.com/o/n/actions/runs/42")
})

test("a hostile commit URL renders as plain text instead of a link", () => {
    const job = summarizeProfile(
        profileWith({ job: "build", workflow: "ci", repository: "o/n", run_id: "42" }),
    )
    assert.notEqual(job, null)

    const review = buildRunReview({
        repo: "o/n",
        sha: "abcdef1234567890",
        commitUrl: "javascript:alert(1)",
        appUrl: "",
        jobs: [/** @type {any} */ (job)],
    })
    const body = renderRunReview(review)

    assert.ok(!body.includes("javascript:"), "no javascript: target survives into the rendered body")
    assert.ok(body.includes("`abcdef1`"), "the short sha renders as plain code")
})
