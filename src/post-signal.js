/** @typedef {import("./post-profile-state.js").ProfileState} ProfileState */

/**
 * @typedef {object} JibrilUnitState
 * @property {string} activeState
 * @property {string} result
 * @property {number} execMainStatus
 */

/**
 * @typedef {object} AgentStopEvidence
 * @property {string} jobStatus
 * @property {JibrilUnitState | null} unitStateBeforeStop
 * @property {JibrilUnitState | null} unitStateAfterStop
 * @property {"completed" | "timed_out"} stopOutcome
 * @property {boolean} forceStopped
 * @property {number} stopTimeoutSeconds
 * @property {ProfileState} profileState
 */

/**
 * @typedef {"run_cancelled" | "crashed" | "flush_timeout" | "stopped_cleanly"} AgentStopReason
 */

/**
 * @param {AgentStopEvidence} evidence
 * @returns {AgentStopReason}
 */
export function classifyAgentStop(evidence) {
    const status = evidence.jobStatus.trim().toLowerCase()
    if (status === "cancelled" || status === "canceled") {
        return "run_cancelled"
    }

    const before = evidence.unitStateBeforeStop
    if (before !== null) {
        const hasFailureState = before.activeState === "failed"
        const hasInactiveFailure = before.activeState === "inactive" && before.result !== "success"
        const hasNonZeroStatus = before.execMainStatus !== 0
        if (hasFailureState || hasInactiveFailure || hasNonZeroStatus) {
            return "crashed"
        }
    }

    if (evidence.stopOutcome === "timed_out") {
        return "flush_timeout"
    }

    return "stopped_cleanly"
}

/**
 * @param {AgentStopEvidence} evidence
 * @returns {string}
 */
export function formatAgentStopDetail(evidence) {
    /** @type {string[]} */
    const parts = []

    if (evidence.stopOutcome === "timed_out") {
        parts.push(`stop timed out after ${evidence.stopTimeoutSeconds}s`)
    } else {
        parts.push("stop completed")
    }

    if (evidence.forceStopped) {
        parts.push("unit SIGKILLed")
    }

    parts.push(getProfileStateDetail(evidence.profileState))

    return parts.join("; ")
}

/**
 * @param {ProfileState} profileState
 * @returns {string}
 */
function getProfileStateDetail(profileState) {
    if (profileState === "missing") {
        return "profile file missing"
    }
    if (profileState === "empty") {
        return "profile file empty"
    }
    if (profileState === "invalid") {
        return "profile JSON invalid"
    }
    return "profile present"
}
