import { formatEbpfErrors } from "./jibril-status.js"
import { versionAtLeast } from "./jibril-version.js"

/** @typedef {import("./jibril-status.js").JibrilStatus} JibrilStatus */
/** @typedef {import("./runtime-review.js").StepSummaryContext} StepSummaryContext */

/**
 * What the main step recorded about the sensor binary it installed.
 * `matched` means every bundle digest matched the signed release manifest;
 * `unavailable` means the release predates signed bundles.
 * @typedef {"matched" | "unavailable" | ""} SensorBundleState
 */

/**
 * `signed` means `gh attestation verify` accepted the expected signer
 * workflow; the skipped states name why the check did not run.
 * @typedef {"signed" | "skipped_no_token" | "skipped_no_gh" | "unavailable" | ""} SensorAttestationState
 */

/**
 * @typedef {object} RecordingObservations
 * @property {string} jibrilVersion
 * @property {string} sensorBundle - the main step's saved SensorBundleState
 * @property {string} sensorAttestation - the main step's saved SensorAttestationState
 * @property {"completed" | "timed_out"} stopOutcome
 * @property {boolean} forceStopped
 * @property {number} stopTimeoutSeconds
 * @property {JibrilStatus | null} runStatus
 */

/** @type {Readonly<Record<string, string>>} */
const SENSOR_INTEGRITY = Object.freeze({
    matched: "bundle digests match the signed release manifest",
    unavailable: "not checked: this Jibril release ships no signed bundle",
})

/** @type {Readonly<Record<string, string>>} */
const SENSOR_AUTHENTICITY = Object.freeze({
    signed: "signed by the jibril-releases release workflow (gh attestation)",
    skipped_no_token: "not checked: github_token is unset",
    skipped_no_gh: "not checked: gh CLI is unavailable",
    unavailable: "not checked: this Jibril release ships no attestation",
})

/**
 * Phrases how the capture went, from the sensor's own account. Gaps are
 * named; a clean account is still only what the sensor reported.
 * @param {RecordingObservations} observations
 * @returns {string}
 */
function describeCapture(observations) {
    /** @type {string[]} */
    const gaps = []
    if (observations.stopOutcome === "timed_out") {
        const forced = observations.forceStopped ? "; sensor force-stopped" : ""
        gaps.push(`stop timed out after ${observations.stopTimeoutSeconds}s${forced}`)
    }

    const runStatus = observations.runStatus
    if (runStatus !== null) {
        if (runStatus.ebpf === null) {
            gaps.push("no eBPF counters reported")
        } else {
            const errors = formatEbpfErrors(runStatus.ebpf.errors)
            if (errors !== "") gaps.push(`eBPF errors: ${errors}`)
        }
    }

    if (gaps.length > 0) return `capture incomplete: ${gaps.join("; ")}`
    if (runStatus !== null) return "no capture gaps reported by the sensor"
    if (versionAtLeast(observations.jibrilVersion, 2, 17, 0)) return "capture state not reported by the sensor"
    return "capture state not reported (sensor before v2.17)"
}

/**
 * @param {JibrilStatus | null} runStatus
 * @returns {string}
 */
function describeSteps(runStatus) {
    const steps = runStatus === null ? null : runStatus.githubSteps
    if (steps === null) return ""
    const source = steps.source === null ? "" : ` (source: ${steps.source})`
    const degraded = steps.status === "degraded" ? "; step attribution degraded" : ""
    return `${steps.count} recorded${source}${degraded}`
}

/**
 * The Step Summary's post-step context. Every value is phrased from what
 * the action or the sensor recorded; nothing here claims more than the
 * named check showed.
 * @param {RecordingObservations} observations
 * @returns {StepSummaryContext}
 */
export function buildRecordingContext(observations) {
    return {
        sensor: observations.jibrilVersion === "" ? "" : `Jibril ${observations.jibrilVersion}`,
        capture: describeCapture(observations),
        sensorIntegrity: SENSOR_INTEGRITY[observations.sensorBundle] ?? "",
        sensorAuthenticity: SENSOR_AUTHENTICITY[observations.sensorAttestation] ?? "",
        steps: describeSteps(observations.runStatus),
    }
}
