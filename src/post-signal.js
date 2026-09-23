import { formatEbpfErrors, formatKernelGaps } from "./jibril-status.js"

/** @typedef {import("./post-profile-state.js").ProfileState} ProfileState */
/** @typedef {import("./jibril-status.js").JibrilStatus} JibrilStatus */
/** @typedef {import("./jibril-status.js").JibrilEbpf} JibrilEbpf */

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
 * @property {JibrilStatus | null} runStatus - what the sensor reported about its own capture, when it reports at all
 */

/**
 * @typedef {"run_cancelled" | "crashed" | "flush_timeout" | "stopped_cleanly" | "start_failed"} AgentStopReason
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
    parts.push(...getRunStatusDetails(evidence.runStatus))

    return parts.join("; ")
}

/**
 * Only reports what the sensor itself flagged: a healthy status adds nothing
 * the profile state does not already say.
 * @param {JibrilStatus | null} runStatus
 * @returns {string[]}
 */
function getRunStatusDetails(runStatus) {
    if (runStatus === null) {
        return []
    }

    /** @type {string[]} */
    const parts = []

    if (runStatus.status !== null && runStatus.status !== "ok") {
        parts.push(`sensor status ${runStatus.status}`)
    }

    const ebpfDetail = getEbpfDetail(runStatus.ebpf)
    if (ebpfDetail !== "") {
        parts.push(ebpfDetail)

        // The kernel's gaps only ever explain a failure; on their own they
        // describe an ordinary host and must not be blamed for anything.
        const kernelGaps = formatKernelGaps(runStatus.kernel)
        if (kernelGaps !== "") {
            parts.push(kernelGaps)
        }
    }

    const steps = runStatus.githubSteps
    if (steps !== null && steps.status !== "ok") {
        parts.push(`github steps ${steps.status} (source=${steps.source}, count=${steps.count})`)
    }

    return parts
}

/**
 * jibril omits the eBPF block until the loader reports counters, so its
 * absence is the strongest explanation there is for an empty profile.
 * @param {JibrilEbpf | null} ebpf
 * @returns {string}
 */
function getEbpfDetail(ebpf) {
    if (ebpf === null) {
        return "ebpf counters never reported"
    }

    const errors = formatEbpfErrors(ebpf.errors)
    if (errors === "") {
        return ""
    }

    return `ebpf errors ${errors}`
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
