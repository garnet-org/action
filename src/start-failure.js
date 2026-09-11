/** @typedef {import("./post-signal.js").JibrilUnitState} JibrilUnitState */
/** @typedef {import("./control-plane/types.js").AgentStoppedRequest} AgentStoppedRequest */
/** @typedef {import("./control-plane/types.js").AgentStoppedJibrilFields} AgentStoppedJibrilFields */

/**
 * @typedef {object} StartFailureDiagnostics
 * @property {JibrilUnitState | null} unitState
 * @property {string} journal
 * @property {string} sensorLog
 */

/**
 * @typedef {object} StartFailure
 * @property {string} reason
 * @property {StartFailureDiagnostics} diagnostics
 */

// Each captured excerpt is bounded so the Job Summary stays readable and the
// control-plane detail stays a short fact, not a log dump.
export const START_FAILURE_EXCERPT_MAX_CHARS = 2000
export const START_FAILURE_DETAIL_MAX_CHARS = 1000
export const START_FAILURE_REASON_MAX_CHARS = 300

/**
 * Keeps the end of the text, where the failing line lands.
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
export function truncateTail(text, maxChars) {
    if (text.length <= maxChars) return text
    return `…${text.slice(text.length - maxChars + 1)}`
}

/**
 * Keeps the start of the text.
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
export function truncateHead(text, maxChars) {
    if (text.length <= maxChars) return text
    return `${text.slice(0, maxChars - 1)}…`
}

/**
 * @param {JibrilUnitState | null} unitState
 * @returns {string}
 */
export function formatUnitState(unitState) {
    if (unitState === null) return ""
    return `ActiveState=${unitState.activeState} Result=${unitState.result} ExecMainStatus=${unitState.execMainStatus}`
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHTML(text) {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

/**
 * @param {string} text
 * @returns {string}
 */
function lastNonEmptyLine(text) {
    const lines = text.split("\n").filter(line => line.trim() !== "")
    const [last = ""] = lines.slice(-1)
    return last.trim()
}

/**
 * The bounded detail the control plane stores alongside the start_failed
 * reason: the failure phrase, the unit state and the sensor's last log line.
 * @param {StartFailure} failure
 * @returns {string}
 */
export function formatStartFailureDetail(failure) {
    const parts = [failure.reason]

    const unitState = formatUnitState(failure.diagnostics.unitState)
    if (unitState !== "") parts.push(unitState)

    const lastLine = lastNonEmptyLine(failure.diagnostics.sensorLog)
    if (lastLine !== "") parts.push(`sensor log: ${lastLine}`)

    return truncateHead(parts.join("; "), START_FAILURE_DETAIL_MAX_CHARS)
}

/**
 * @param {StartFailure} failure
 * @returns {AgentStoppedRequest}
 */
export function buildStartFailedRequest(failure) {
    /** @type {AgentStoppedRequest} */
    const request = {
        reason: "start_failed",
        profileState: "missing",
        detail: formatStartFailureDetail(failure),
    }

    const unitState = failure.diagnostics.unitState
    if (unitState !== null) {
        /** @type {AgentStoppedJibrilFields} */
        const jibril = {
            activeState: unitState.activeState,
            result: unitState.result,
            execMainStatus: unitState.execMainStatus,
        }
        request.jibril = jibril
    }

    return request
}

/**
 * The Job Summary disclosure for a job whose sensor never started: one fact
 * in the Runtime Review terminal register, with the bounded startup log in a
 * collapsed fold so the reader can see why without opening the job log.
 * @param {StartFailure} failure
 * @returns {string}
 */
export function renderStartFailureSummary(failure) {
    const sections = []

    const unitState = formatUnitState(failure.diagnostics.unitState)
    if (unitState !== "") sections.push(`systemd: ${unitState}`)

    if (failure.diagnostics.journal !== "") {
        sections.push(`--- journalctl -u jibril.service ---\n${failure.diagnostics.journal}`)
    }
    if (failure.diagnostics.sensorLog !== "") {
        sections.push(`--- /var/log/jibril.err ---\n${failure.diagnostics.sensorLog}`)
    }
    if (sections.length === 0) {
        sections.push("(no startup log captured)")
    }

    // A fence inside the fold keeps the log verbatim; a stray fence in the log
    // itself would close ours early, so it is neutralised.
    const excerpt = sections.join("\n\n").replaceAll("```", "'''")

    return [
        "**Execution Profile for this job · not recorded**",
        "",
        `<sub>the sensor did not start on this runner — ${escapeHTML(failure.reason)}</sub>`,
        "",
        "<details><summary><sub>sensor startup log</sub></summary>",
        "",
        "```text",
        excerpt,
        "```",
        "",
        "</details>",
    ].join("\n")
}
