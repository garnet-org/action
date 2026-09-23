import assert from "node:assert/strict"
import { test } from "node:test"
import { AGENT_STOPPED_REQUEST_SCHEMA } from "../src/control-plane/types.js"
import {
    buildStartFailedRequest,
    formatStartFailureDetail,
    renderStartFailureSummary,
    START_FAILURE_DETAIL_MAX_CHARS,
    truncateTail,
} from "../src/start-failure.js"

/**
 * @param {Partial<import("../src/start-failure.js").StartFailureDiagnostics>=} overrides
 * @returns {import("../src/start-failure.js").StartFailure}
 */
function createFailure(overrides = {}) {
    return {
        reason: "the jibril service exited early with state 'failed'",
        diagnostics: {
            unitState: { activeState: "failed", result: "exit-code", execMainStatus: 1 },
            journal:
                "Sep 08 17:00:01 runner systemd[1]: jibril.service: Main process exited, code=exited, status=1/FAILURE",
            sensorLog: "loading config\nfailed to resolve workflow file: no such file or directory",
            ...overrides,
        },
    }
}

test("buildStartFailedRequest: start_failed with missing profile validates against the stopped schema", () => {
    const request = buildStartFailedRequest(createFailure())

    assert.equal(request.reason, "start_failed")
    assert.equal(request.profileState, "missing")
    assert.equal("runID" in request, false)
    assert.equal("runAttempt" in request, false)
    assert.equal("job" in request, false)
    assert.deepEqual(request.jibril, { activeState: "failed", result: "exit-code", execMainStatus: 1 })
    assert.deepEqual(AGENT_STOPPED_REQUEST_SCHEMA.parse(request), request)
})

test("buildStartFailedRequest: omits optional fields the runner cannot provide", () => {
    const request = buildStartFailedRequest(createFailure({ unitState: null }))

    assert.equal("runAttempt" in request, false)
    assert.equal("job" in request, false)
    assert.equal("jibril" in request, false)
})

test("formatStartFailureDetail: reason, unit state and the sensor's last log line, bounded", () => {
    assert.equal(
        formatStartFailureDetail(createFailure()),
        "the jibril service exited early with state 'failed'; ActiveState=failed Result=exit-code ExecMainStatus=1; " +
            "sensor log: failed to resolve workflow file: no such file or directory",
    )

    const long = formatStartFailureDetail(createFailure({ sensorLog: "x".repeat(5000) }))
    assert.equal(long.length, START_FAILURE_DETAIL_MAX_CHARS)
    assert.ok(long.endsWith("…"))
})

test("truncateTail: keeps the end of the text where the failing line lands", () => {
    assert.equal(truncateTail("abcdef", 10), "abcdef")
    assert.equal(truncateTail("abcdef", 4), "…def")
})

test("renderStartFailureSummary: terminal register headline, reason, folded startup log", () => {
    const summary = renderStartFailureSummary(createFailure({ sensorLog: "boom ``` <tag>" }))

    assert.equal(
        summary,
        [
            "**Execution Profile for this job · not recorded**",
            "",
            "<sub>the sensor did not start on this runner — the jibril service exited early with state 'failed'</sub>",
            "",
            "<details><summary><sub>sensor startup log</sub></summary>",
            "",
            "```text",
            "systemd: ActiveState=failed Result=exit-code ExecMainStatus=1",
            "",
            "--- journalctl -u jibril.service ---",
            "Sep 08 17:00:01 runner systemd[1]: jibril.service: Main process exited, code=exited, status=1/FAILURE",
            "",
            "--- /var/log/jibril.err ---",
            "boom ''' <tag>",
            "```",
            "",
            "</details>",
        ].join("\n"),
    )
})

test("renderStartFailureSummary: escapes the reason and names an empty capture", () => {
    const summary = renderStartFailureSummary({
        reason: "setup did not complete: <redacted> & more",
        diagnostics: { unitState: null, journal: "", sensorLog: "" },
    })

    assert.ok(summary.includes("setup did not complete: &lt;redacted&gt; &amp; more"))
    assert.ok(summary.includes("(no startup log captured)"))
})
