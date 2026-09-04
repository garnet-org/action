import assert from "node:assert/strict"
import { test } from "node:test"
import { classifyAgentStop, formatAgentStopDetail } from "../src/post-signal.js"

/**
 * @param {Partial<import("../src/post-signal.js").AgentStopEvidence>=} overrides
 * @returns {import("../src/post-signal.js").AgentStopEvidence}
 */
function createEvidence(overrides = {}) {
    return {
        jobStatus: "",
        unitStateBeforeStop: null,
        unitStateAfterStop: null,
        stopOutcome: "completed",
        forceStopped: false,
        stopTimeoutSeconds: 1830,
        profileState: "missing",
        ...overrides,
    }
}

test("classifyAgentStop: cancelled status maps to run_cancelled", () => {
    assert.equal(classifyAgentStop(createEvidence({ jobStatus: "canceled" })), "run_cancelled")
    assert.equal(classifyAgentStop(createEvidence({ jobStatus: "cancelled" })), "run_cancelled")
})

test("classifyAgentStop: crashed state wins over flush timeout", () => {
    const evidence = createEvidence({
        stopOutcome: "timed_out",
        unitStateBeforeStop: {
            activeState: "failed",
            result: "signal",
            execMainStatus: 9,
        },
    })

    assert.equal(classifyAgentStop(evidence), "crashed")
})

test("classifyAgentStop: timeout maps to flush_timeout when not crashed", () => {
    assert.equal(classifyAgentStop(createEvidence({ stopOutcome: "timed_out" })), "flush_timeout")
})

test("formatAgentStopDetail: timeout + force stop + missing profile", () => {
    const detail = formatAgentStopDetail(
        createEvidence({
            stopOutcome: "timed_out",
            forceStopped: true,
            profileState: "missing",
        }),
    )

    assert.equal(detail, "stop timed out after 1830s; unit SIGKILLed; profile file missing")
})
