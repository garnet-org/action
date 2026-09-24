// Readiness status files written by jibril (v2.17.0 and later) under
// /var/run/jibril. Both are written once, right before the sensor enters its
// main event loop, so their presence is the first moment at which events are
// being captured, and the snapshot they hold is complete from then on:
//
//   - ebpf.status.json   the eBPF layer: loader counters and failures
//   - jibril.status.json the whole sensor: one block per feature
//
// Both share the same envelope, and jibril.status.json carries the identical
// eBPF block under `features` plus `github` on a runner, so one parser reads
// both. The shapes mirror jibril's `pkg/pkgs/runstatus`; only the fields this
// action acts on are read.

import { getOptionalNumber, getOptionalRecord, getOptionalString } from "./shared.js"

const JIBRIL_STATUS_DIR = "/var/run/jibril"
export const JIBRIL_EBPF_STATUS_FILE = `${JIBRIL_STATUS_DIR}/ebpf.status.json`
export const JIBRIL_RUN_STATUS_FILE = `${JIBRIL_STATUS_DIR}/jibril.status.json`

/**
 * The health of the sensor, or of one of its features (runstatus.State).
 * `disabled` is also the state of a feature that never ran.
 * @typedef {"disabled" | "ok" | "degraded"} JibrilState
 */

/** @type {readonly JibrilState[]} */
const STATES = ["disabled", "ok", "degraded"]

/**
 * Where jibril discovered the workflow steps (runstatus.Source*).
 * @typedef {"none" | "api" | "local"} JibrilStepsSource
 */

/** @type {readonly JibrilStepsSource[]} */
const STEPS_SOURCES = ["none", "api", "local"]

/**
 * The active kernel lockdown mode. jibril writes `unknown` itself when the
 * host hides /sys/kernel/security/lockdown, which says nothing about whether
 * lockdown is on.
 * @typedef {"none" | "integrity" | "confidentiality" | "unknown"} JibrilLockdown
 */

/** @type {readonly JibrilLockdown[]} */
const LOCKDOWN_MODES = ["none", "integrity", "confidentiality", "unknown"]

/**
 * A program the loader could not attach. The kernel hook it names is blind
 * for the whole run.
 * @typedef {object} JibrilAttachFailure
 * @property {string} program
 * @property {string} error
 */

/**
 * Failures counted by the stage they happened in: `load` covers object load
 * and map, program and ringbuf creation, `attach` covers bond creation and
 * the attach call, `link` covers detach and destroy operations.
 * @typedef {object} JibrilEbpfErrors
 * @property {number} load
 * @property {number} attach
 * @property {number} link
 * @property {JibrilAttachFailure[]} attachFailures - one entry per program behind the attach count
 */

/**
 * `attached` counts successful attach calls including tail programs, which
 * hold no link, so it is always greater than or equal to `liveLinks`.
 * @typedef {object} JibrilEbpf
 * @property {number} programs
 * @property {number} attached
 * @property {number} liveLinks
 * @property {JibrilEbpfErrors} errors
 */

/**
 * The outcome of the workflow step discovery. A degraded discovery costs the
 * workflow-step attribution on events, nothing else.
 * @typedef {object} JibrilSteps
 * @property {JibrilState | null} status
 * @property {JibrilStepsSource | null} source
 * @property {number} count
 * @property {string[]} errors
 */

/**
 * What the kernel offered the loader, which is where most attach failures
 * come from: BTF is what CO-RE, fentry and tp_btf programs need, the BPF LSM
 * is what bpf_lsm programs attach to, tracefs carries the kprobe and
 * tracepoint hooks, cgroup2 is the hierarchy cgroup_skb programs attach to,
 * and lockdown in confidentiality mode blocks the kernel reads the programs
 * are built around. A capability jibril could not probe reads as false,
 * which is what unsupported means from the loader's side. `lsm` is reported
 * but never blamed: hosted runners do not enable it.
 * @typedef {object} JibrilKernelBpf
 * @property {boolean} btf
 * @property {boolean} lsm
 * @property {boolean} tracefs
 * @property {boolean} cgroup2
 * @property {JibrilLockdown | null} lockdown
 */

/**
 * @typedef {object} JibrilKernel
 * @property {string} release
 * @property {JibrilKernelBpf} bpf
 */

/**
 * @typedef {object} JibrilStatus
 * @property {JibrilState | null} status
 * @property {string} readyAt
 * @property {JibrilKernel | null} kernel
 * @property {JibrilEbpf | null} ebpf - null until the loader reports its counters, so an early write never claims a clean load
 * @property {JibrilSteps | null} githubSteps - null off a GitHub runner
 */

/**
 * Parses either status file. Null covers every way the file can fail to say
 * anything: not written yet, unreadable, or not holding a status object.
 * @param {string} content
 * @returns {JibrilStatus | null}
 */
export function parseJibrilStatus(content) {
    /** @type {unknown} */
    let parsed
    try {
        parsed = JSON.parse(content)
    } catch {
        return null
    }

    const record = getOptionalRecord(parsed)
    if (record === null || Array.isArray(parsed)) {
        return null
    }

    const features = getOptionalRecord(record.features)
    // ebpf.status.json keeps the block at the top level and always writes it;
    // jibril.status.json nests the identical block under `features` and omits
    // it until the loader has counters to report.
    const ebpf = features === null ? record.ebpf : features.ebpf

    return {
        status: readEnum(STATES, record.status),
        readyAt: getOptionalString(record.ready_at) ?? "",
        kernel: readKernel(record.kernel),
        ebpf: readEbpf(ebpf),
        githubSteps: readGitHubSteps(features),
    }
}

/**
 * Names only the non-zero counters, so it is empty exactly when the loader
 * reported no failure at all, which is also when jibril calls itself ok.
 * @param {JibrilEbpfErrors} errors
 * @returns {string}
 */
export function formatEbpfErrors(errors) {
    /** @type {string[]} */
    const parts = []

    if (errors.load > 0) parts.push(`load=${errors.load}`)
    if (errors.attach > 0) parts.push(`attach=${errors.attach}`)
    if (errors.link > 0) parts.push(`link=${errors.link}`)

    return parts.join(", ")
}

/**
 * @param {JibrilAttachFailure[]} failures
 * @returns {string}
 */
export function formatAttachFailures(failures) {
    return failures.map(failure => `${failure.program}: ${failure.error}`).join("; ")
}

/**
 * Names what this kernel did not offer the loader, and only what is unusual
 * enough to explain a failure: hosted runners ship without the BPF LSM and
 * under lockdown integrity, so neither is evidence of anything on its own.
 * Empty when there is nothing to explain, which keeps a healthy run from
 * ever blaming its kernel.
 * @param {JibrilKernel | null} kernel
 * @returns {string}
 */
export function formatKernelGaps(kernel) {
    if (kernel === null) return ""

    /** @type {string[]} */
    const gaps = []

    if (!kernel.bpf.btf) gaps.push("no BTF")
    if (!kernel.bpf.tracefs) gaps.push("no tracefs")
    if (!kernel.bpf.cgroup2) gaps.push("no cgroup2")
    if (kernel.bpf.lockdown === "confidentiality") {
        gaps.push("lockdown confidentiality")
    }

    if (gaps.length === 0) return ""

    return `kernel ${kernel.release} offers ${gaps.join(", ")}`
}

/**
 * One log line describing what the sensor reported about itself.
 * @param {JibrilStatus} status
 * @returns {string}
 */
export function formatJibrilStatusSummary(status) {
    /** @type {string[]} */
    const parts = [`status=${status.status ?? UNREPORTED}`]

    if (status.readyAt !== "") parts.push(`ready_at=${status.readyAt}`)
    if (status.kernel !== null) parts.push(`kernel=${status.kernel.release}`)

    if (status.ebpf === null) {
        parts.push(`ebpf=${UNREPORTED}`)
    } else {
        const { programs, attached, liveLinks, errors } = status.ebpf
        parts.push(`ebpf programs=${programs}/attached=${attached}/live_links=${liveLinks}`)
        parts.push(`ebpf errors=${formatEbpfErrors(errors) || "none"}`)
    }

    const steps = status.githubSteps
    if (steps !== null) {
        parts.push(
            `github steps=${steps.status ?? UNREPORTED} (source=${steps.source ?? UNREPORTED}, count=${steps.count})`,
        )
    }

    return parts.join(", ")
}

const UNREPORTED = "(unreported)"

/**
 * @param {unknown} value
 * @returns {JibrilKernel | null}
 */
function readKernel(value) {
    const record = getOptionalRecord(value)
    if (record === null) return null

    const bpf = getOptionalRecord(record.bpf)

    return {
        release: getOptionalString(record.release) ?? "",
        bpf: {
            btf: bpf?.btf === true,
            lsm: bpf?.lsm === true,
            tracefs: bpf?.tracefs === true,
            cgroup2: bpf?.cgroup2 === true,
            lockdown: readEnum(LOCKDOWN_MODES, bpf?.lockdown),
        },
    }
}

/**
 * @param {unknown} value
 * @returns {JibrilEbpf | null}
 */
function readEbpf(value) {
    const record = getOptionalRecord(value)
    if (record === null) return null

    const errors = getOptionalRecord(record.errors)

    return {
        programs: readCount(record.programs),
        attached: readCount(record.attached),
        liveLinks: readCount(record.live_links),
        errors: {
            load: readCount(errors?.load),
            attach: readCount(errors?.attach),
            link: readCount(errors?.link),
            attachFailures: readAttachFailures(errors?.attach_failures),
        },
    }
}

/**
 * The github block is written whenever the job environment is there to
 * report, and always carries a steps block; off a runner it is absent.
 * @param {Record<string, unknown> | null} features
 * @returns {JibrilSteps | null}
 */
function readGitHubSteps(features) {
    const github = getOptionalRecord(features?.github)
    const steps = getOptionalRecord(github?.steps)
    if (steps === null) return null

    return {
        status: readEnum(STATES, steps.status),
        source: readEnum(STEPS_SOURCES, steps.source),
        count: readCount(steps.count),
        errors: readStringList(steps.errors),
    }
}

/**
 * @param {unknown} value
 * @returns {JibrilAttachFailure[]}
 */
function readAttachFailures(value) {
    if (!Array.isArray(value)) return []

    /** @type {JibrilAttachFailure[]} */
    const failures = []
    for (const entry of value) {
        const record = getOptionalRecord(entry)
        if (record === null) continue

        failures.push({
            program: getOptionalString(record.program) ?? "",
            error: getOptionalString(record.error) ?? "",
        })
    }

    return failures
}

/**
 * Resolves one of a known set of values, so nothing downstream handles a
 * free-form string. Null means jibril reported something outside the set,
 * which is not a known value and must not be reported as one.
 * @template {string} T
 * @param {readonly T[]} members
 * @param {unknown} value
 * @returns {T | null}
 */
function readEnum(members, value) {
    return members.find(member => member === value) ?? null
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function readCount(value) {
    const count = getOptionalNumber(value)
    if (count === undefined || !Number.isFinite(count) || count < 0) return 0

    return Math.trunc(count)
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function readStringList(value) {
    if (!Array.isArray(value)) return []

    return value.filter(entry => typeof entry === "string" && entry.trim() !== "")
}
