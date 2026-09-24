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
        runStatus: null,
        ...overrides,
    }
}

/**
 * A healthy sensor on an ordinary runner: no BPF LSM in the active list, and
 * that is not a finding.
 * @param {Partial<import("../src/jibril-status.js").JibrilStatus>=} overrides
 * @returns {import("../src/jibril-status.js").JibrilStatus}
 */
function createRunStatus(overrides = {}) {
    return {
        status: "ok",
        readyAt: "2026-09-10T21:52:40Z",
        kernel: {
            release: "6.8.0-1014-aws",
            bpf: { btf: true, lsm: false, tracefs: true, cgroup2: true, lockdown: "none" },
        },
        ebpf: {
            programs: 12,
            attached: 12,
            liveLinks: 10,
            errors: { load: 0, attach: 0, link: 0, attachFailures: [] },
        },
        githubSteps: { status: "ok", source: "api", count: 7, errors: [] },
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

test("formatAgentStopDetail: a healthy sensor adds nothing, and its kernel is not blamed", () => {
    const detail = formatAgentStopDetail(createEvidence({ profileState: "empty", runStatus: createRunStatus() }))

    assert.equal(detail, "stop completed; profile file empty")
})

test("formatAgentStopDetail: a degraded sensor explains the partial capture", () => {
    const healthy = createRunStatus()
    const detail = formatAgentStopDetail(
        createEvidence({
            profileState: "empty",
            runStatus: createRunStatus({
                status: "degraded",
                ebpf: { ...healthy.ebpf, errors: { load: 1, attach: 0, link: 2, attachFailures: [] } },
                githubSteps: { status: "degraded", source: "local", count: 3, errors: ["github api: 403"] },
            }),
        }),
    )

    assert.equal(
        detail,
        "stop completed; profile file empty; sensor status degraded; ebpf errors load=1, link=2; " +
            "github steps degraded (source=local, count=3)",
    )
})

test("formatAgentStopDetail: an eBPF block jibril never wrote points at the kernel", () => {
    const detail = formatAgentStopDetail(
        createEvidence({
            profileState: "empty",
            runStatus: createRunStatus({
                ebpf: null,
                kernel: {
                    release: "6.8.0-1014-aws",
                    bpf: { btf: false, lsm: true, tracefs: true, cgroup2: true, lockdown: "none" },
                },
            }),
        }),
    )

    assert.equal(
        detail,
        "stop completed; profile file empty; ebpf counters never reported; kernel 6.8.0-1014-aws offers no BTF",
    )
})
