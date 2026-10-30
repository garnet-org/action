/**
 * The Action renders the Step Summary only; the Garnet App posts the PR
 * comment (fork PRs included, through the relay artifact). These gates keep
 * PR-comment rendering out of the shipped bundle and the relay bytes fixed.
 */
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { buildRunArtifact, resolveRunArtifactName, serializeRunArtifact } from "../src/run-artifact.js"

const DIST_BUNDLES = ["dist/main/index.js", "dist/post/index.js"]

const COMMENT_RENDERER_MARKERS = [
    "renderRunReview",
    "renderPendingReview",
    "renderCommentBody",
    "renderCommentFooter",
    "renderJobDiffTree",
    "renderReferenceMockup",
    "renderMinimalComment",
    "exportReviewModel",
    "garnet:summary",
    "garnet:commit",
    "Runtime behavior, recorded by Garnet.",
    "Add it to your CI",
    "utm_medium=pr_comment",
    "garnet-run-profile",
    "garnet-reference-renderer-mockup",
    "(previous) vs",
    "This comment updates when the remaining jobs finish.",
]

/** @type {import("../src/control-plane/types.js").CreateAgentRequest} */
const AGENT = {
    os: "linux",
    arch: "amd64",
    hostname: "fv-az1234-567-1122334455-test",
    version: "v2.17.0",
    ip: "10.1.0.4",
    machine_id: "f3b1c0de",
    kind: "github",
    github_context: {
        job: "test",
        run_id: "1122334455",
        workflow: "CI",
        repository: "acme/app",
        repository_id: "123456",
        ref_protected: false,
    },
}

/** @type {import("../src/control-plane/types.js").AgentStoppedRequest} */
const STOPPED = {
    reason: "stopped_cleanly",
    profileState: "present",
    detail: "profile written",
    jobStatus: "success",
    jibril: { stopOutcome: "completed", forceStopped: false },
}

test("dist: the shipped bundles carry no PR-comment renderer symbols or markers", () => {
    for (const bundle of DIST_BUNDLES) {
        const source = readFileSync(bundle, "utf8")
        for (const marker of COMMENT_RENDERER_MARKERS) {
            assert.ok(!source.includes(marker), `${bundle} contains ${JSON.stringify(marker)}`)
        }
    }
})

test("dist: the post bundle still renders the Step Summary and uploads the relay artifact", () => {
    const post = readFileSync("dist/post/index.js", "utf8")
    for (const symbol of ["renderStepSummary", "buildRunArtifact", "uploadRunArtifact", "garnet-run-", "garnet/run.json"]) {
        assert.ok(post.includes(symbol), `dist/post/index.js lost ${JSON.stringify(symbol)}`)
    }
})

test("relay: the garnet-run-* artifact name and payload bytes are unchanged", () => {
    const profile = JSON.parse(readFileSync("test/fixtures/renderer-testdata/synthetic/credential-argv.json", "utf8"))
    const name = resolveRunArtifactName({ job: "relay", jobIndex: 1, runAttempt: "1", uniqueSuffix: "a1b2c3d4" })
    assert.equal(name, "garnet-run-relay-1-attempt-1")
    const { content, profileOmitted } = serializeRunArtifact(
        buildRunArtifact({ agent: AGENT, jobIndex: 1, profile, stopped: STOPPED }),
    )
    assert.equal(profileOmitted, false)
    assert.equal(content, readFileSync("test/fixtures/run-artifact/relay-envelope.json", "utf8"))
})
