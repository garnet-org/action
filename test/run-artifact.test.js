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
/** @typedef {import("../src/run-artifact.js").RunArtifactNameInput} RunArtifactNameInput */

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
        workflow: "CI",
        repository: "acme/app",
        repository_id: "123456",
        ref_protected: false,
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

/**
 * @param {Partial<RunArtifactNameInput>} overrides
 * @returns {string}
 */
function nameWith(overrides) {
    return resolveRunArtifactName({
        job: "relay",
        jobIndex: null,
        runAttempt: "1",
        uniqueSuffix: "a1b2c3d4",
        ...overrides,
    })
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

    const unknownLeg = buildRunArtifact({ agent: AGENT, jobIndex: null, profile: null, stopped: STOPPED })
    assert.ok(
        !("job_index" in (unknownLeg.agent.github_context ?? {})),
        "an unknown leg index must be omitted: 0 would claim this job is matrix leg 0",
    )
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

test("name: deterministic per leg and attempt, unique when no leg index exists", () => {
    // A re-run's artifacts sit alongside the previous attempt's and can only
    // be collapsed by matching names, so a known leg yields a stable name.
    const slugged = nameWith({ job: "build & test (ubuntu)", jobIndex: 0, runAttempt: "2" })
    assert.equal(slugged, "garnet-run-build-test-ubuntu-0-attempt-2")
    assert.notEqual(nameWith({ jobIndex: 0 }), nameWith({ jobIndex: 1 }))
    assert.notEqual(nameWith({ jobIndex: 0, runAttempt: "1" }), nameWith({ jobIndex: 0, runAttempt: "2" }))

    // Without one, nothing else tells the legs of a matrix apart, and a
    // collision costs the losing leg its whole envelope.
    assert.equal(nameWith({}), "garnet-run-relay-a1b2c3d4-attempt-1")
    assert.notEqual(nameWith({}), nameWith({ uniqueSuffix: "e5f6a7b8" }))
})

test("serialize: profile passed through, dropped when it blows the budget", () => {
    const profile = { scenarios: { github: { job_index: 2 } } }
    const small = serializeRunArtifact(buildRunArtifact({ agent: AGENT, jobIndex: 2, profile, stopped: STOPPED }))

    assert.equal(small.profileOmitted, false)
    assert.deepEqual(JSON.parse(small.content).profile, profile)

    const huge = serializeRunArtifact(
        buildRunArtifact({ agent: AGENT, jobIndex: 2, profile: { blob: "x".repeat(17 * 1024 * 1024) }, stopped: STOPPED }),
    )

    assert.equal(huge.profileOmitted, true)
    assert.ok(Buffer.byteLength(huge.content, "utf8") < 16 * 1024 * 1024)

    const parsed = JSON.parse(huge.content)
    assert.equal(parsed.profile, null)
    // "invalid" renders as "the record could not be read"; "present" with a
    // null profile would render as still-recording, forever.
    assert.equal(parsed.stopped.profileState, "invalid")
    assert.match(parsed.stopped.detail, /profile written; profile omitted: \d+ bytes exceeds/)
    AGENT_STOPPED_REQUEST_SCHEMA.parse(parsed.stopped)
})
