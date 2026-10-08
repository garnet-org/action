/**
 * The relay envelope is rejected whole on a shape mismatch and dropped
 * silently when oversized, with no retry either way, so these gates cover
 * the failures that cost a fork contributor their entire Runtime Review.
 */
import test from "node:test"
import assert from "node:assert/strict"
import {
    buildRunArtifact,
    readProfileJobIndex,
    resolveRunArtifactName,
    serializeRunArtifact,
} from "../src/run-artifact.js"
import { AGENT_STOPPED_REQUEST_SCHEMA, CREATE_AGENT_REQUEST_SCHEMA } from "../src/control-plane/types.js"

/** @typedef {import("../src/control-plane/types.js").CreateAgentRequest} CreateAgentRequest */
/** @typedef {import("../src/control-plane/types.js").AgentStoppedRequest} AgentStoppedRequest */

/** @type {CreateAgentRequest} */
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
        run_attempt: "1",
        run_number: "42",
        workflow: "CI",
        workflow_ref: "acme/app/.github/workflows/ci.yaml@refs/pull/17/merge",
        workflow_sha: "b".repeat(40),
        repository: "acme/app",
        repository_id: "123456",
        repository_owner: "acme",
        repository_owner_id: "7890",
        sha: "a".repeat(40),
        ref: "refs/pull/17/merge",
        ref_name: "17/merge",
        ref_type: "branch",
        ref_protected: false,
        event_name: "pull_request",
        action: "__run",
        actor: "contributor",
        actor_id: "4242",
        triggering_actor: "contributor",
        runner_os: "Linux",
        runner_arch: "X64",
        server_url: "https://github.com",
        workspace: "/home/runner/work/app/app",
    },
}

/** @type {AgentStoppedRequest} */
const STOPPED = {
    reason: "stopped_cleanly",
    profileState: "present",
    detail: "profile written",
    jobStatus: "failure",
    jibril: { stopOutcome: "completed", forceStopped: false },
}

test("envelope: schema_version 1 over the exact bodies the authenticated path POSTs", () => {
    const envelope = buildRunArtifact({ agent: AGENT, jobIndex: 2, profile: null, stopped: STOPPED })

    assert.equal(envelope.schema_version, 1)
    assert.equal(envelope.profile, null, "a null profile is a normal case, not an error")
    assert.equal(envelope.agent.github_context?.job_index, 2)

    // The same serializers, so the same schemas accept them. This is also
    // what keeps `agent` snake_case while `stopped` stays camelCase.
    CREATE_AGENT_REQUEST_SCHEMA.parse(envelope.agent)
    AGENT_STOPPED_REQUEST_SCHEMA.parse(envelope.stopped)
})

test("envelope: an unknown leg index is omitted, never sent as 0", () => {
    const envelope = buildRunArtifact({ agent: AGENT, jobIndex: null, profile: null, stopped: STOPPED })

    assert.ok(envelope.agent.github_context !== undefined)
    assert.ok(!("job_index" in envelope.agent.github_context), "0 would claim this job is matrix leg 0")
})

test("job index: read when jibril recorded one, null when it did not", () => {
    assert.equal(readProfileJobIndex({ scenarios: { github: { job_index: 4 } } }), 4)
    assert.equal(readProfileJobIndex({ scenarios: { github: { job_index: 0 } } }), 0)

    for (const profile of [
        null,
        {},
        { scenarios: { github: null } },
        { scenarios: { github: {} } },
        { scenarios: { github: { job_index: "4" } } },
        { scenarios: { github: { job_index: -1 } } },
    ]) {
        assert.equal(readProfileJobIndex(profile), null, JSON.stringify(profile))
    }
})

test("name: deterministic per job and attempt when the leg index is known", () => {
    // A re-run's artifacts sit alongside the previous attempt's, and the
    // only way to collapse the stale ones is by matching names, so the same
    // job on the same attempt must always produce the same name.
    const name = resolveRunArtifactName({
        job: "build & test (ubuntu)",
        jobIndex: 0,
        runAttempt: "2",
        uniqueSuffix: "a1b2c3d4",
    })

    assert.equal(name, "garnet-run-build-test-ubuntu-0-attempt-2")
    assert.notEqual(name, resolveRunArtifactName({ job: "build & test (ubuntu)", jobIndex: 1, runAttempt: "2", uniqueSuffix: "a1b2c3d4" }))
    assert.notEqual(name, resolveRunArtifactName({ job: "build & test (ubuntu)", jobIndex: 0, runAttempt: "1", uniqueSuffix: "a1b2c3d4" }))
})

test("name: falls back to a unique suffix when no leg index was recorded", () => {
    // Nothing else tells the legs of a matrix apart, and a collision costs
    // the losing leg its whole envelope.
    const first = resolveRunArtifactName({ job: "relay", jobIndex: null, runAttempt: "1", uniqueSuffix: "a1b2c3d4" })
    const second = resolveRunArtifactName({ job: "relay", jobIndex: null, runAttempt: "1", uniqueSuffix: "e5f6a7b8" })

    assert.equal(first, "garnet-run-relay-a1b2c3d4-attempt-1")
    assert.notEqual(first, second)
})

test("oversized: the profile is dropped so the rest still produces a comment", () => {
    const envelope = buildRunArtifact({
        agent: AGENT,
        jobIndex: 2,
        profile: { blob: "x".repeat(17 * 1024 * 1024) },
        stopped: STOPPED,
    })

    const serialized = serializeRunArtifact(envelope)
    assert.equal(serialized.profileOmitted, true)
    assert.ok(Buffer.byteLength(serialized.content, "utf8") < 16 * 1024 * 1024)

    const parsed = JSON.parse(serialized.content)
    assert.equal(parsed.profile, null)
    // "invalid" renders as "the record could not be read"; "present" with a
    // null profile would render as still-recording, forever.
    assert.equal(parsed.stopped.profileState, "invalid")
    assert.match(parsed.stopped.detail, /profile written; profile omitted: \d+ bytes exceeds/)
    AGENT_STOPPED_REQUEST_SCHEMA.parse(parsed.stopped)
})

test("within budget: the profile is passed through untouched", () => {
    const profile = { scenarios: { github: { job_index: 2 } } }
    const serialized = serializeRunArtifact(
        buildRunArtifact({ agent: AGENT, jobIndex: 2, profile, stopped: STOPPED }),
    )

    assert.equal(serialized.profileOmitted, false)
    assert.deepEqual(JSON.parse(serialized.content).profile, profile)
})
