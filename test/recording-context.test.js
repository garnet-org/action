import { test } from "node:test"
import assert from "node:assert/strict"

import { buildRecordingContext } from "../src/recording-context.js"

/**
 * @param {Partial<import("../src/recording-context.js").RecordingObservations>} overrides
 */
function observations(overrides) {
    return {
        jibrilVersion: "v2.17.0",
        sensorBundle: "matched",
        sensorAttestation: "signed",
        stopOutcome: /** @type {"completed"} */ ("completed"),
        forceStopped: false,
        stopTimeoutSeconds: 1800,
        runStatus: {
            status: /** @type {"ok"} */ ("ok"),
            readyAt: "",
            kernel: null,
            ebpf: { errors: { load: 0, attach: 0, link: 0, attachFailures: [] } },
            githubSteps: {
                status: /** @type {"ok"} */ ("ok"),
                source: /** @type {"api"} */ ("api"),
                count: 8,
                errors: [],
            },
        },
        ...overrides,
    }
}

test("a clean run reports only what the sensor said, never more", () => {
    const context = buildRecordingContext(observations({}))
    assert.deepEqual(context, {
        sensor: "Jibril v2.17.0",
        capture: "no capture gaps reported by the sensor",
        sensorIntegrity: "bundle digests match the signed release manifest",
        sensorAuthenticity: "signed by the jibril-releases release workflow (gh attestation)",
        steps: "8 recorded (source: api)",
    })
    for (const value of Object.values(context)) {
        assert.doesNotMatch(value, /verified|detected|caught|\bsafe\b/i)
    }
})

test("capture gaps say capture incomplete and name every gap", () => {
    const timedOut = buildRecordingContext(observations({ stopOutcome: "timed_out", forceStopped: true }))
    assert.equal(timedOut.capture, "capture incomplete: stop timed out after 1800s; sensor force-stopped")

    const noCounters = buildRecordingContext(observations({ runStatus: { ...observations({}).runStatus, ebpf: null } }))
    assert.equal(noCounters.capture, "capture incomplete: no eBPF counters reported")

    const attach = buildRecordingContext(
        observations({
            runStatus: {
                ...observations({}).runStatus,
                ebpf: { errors: { load: 0, attach: 2, link: 0, attachFailures: [] } },
            },
        }),
    )
    assert.match(attach.capture, /^capture incomplete: eBPF errors: /)
})

test("missing sensor reports and skipped checks are stated, not guessed", () => {
    const silent = buildRecordingContext(observations({ runStatus: null }))
    assert.equal(silent.capture, "capture state not reported by the sensor")
    assert.equal(silent.steps, "")

    const old = buildRecordingContext(
        observations({
            jibrilVersion: "v2.10.4",
            runStatus: null,
            sensorBundle: "unavailable",
            sensorAttestation: "unavailable",
        }),
    )
    assert.equal(old.capture, "capture state not reported (sensor before v2.17)")
    assert.equal(old.sensorIntegrity, "not checked: this Jibril release ships no signed bundle")
    assert.equal(old.sensorAuthenticity, "not checked: this Jibril release ships no attestation")

    assert.equal(
        buildRecordingContext(observations({ sensorAttestation: "skipped_no_token" })).sensorAuthenticity,
        "not checked: github_token is unset",
    )
    assert.equal(
        buildRecordingContext(observations({ sensorAttestation: "skipped_no_gh" })).sensorAuthenticity,
        "not checked: gh CLI is unavailable",
    )
    assert.equal(buildRecordingContext(observations({ sensorBundle: "", sensorAttestation: "" })).sensorIntegrity, "")

    const degraded = buildRecordingContext(
        observations({
            runStatus: {
                ...observations({}).runStatus,
                githubSteps: { status: "degraded", source: "local", count: 3, errors: [] },
            },
        }),
    )
    assert.equal(degraded.steps, "3 recorded (source: local); step attribution degraded")
})
