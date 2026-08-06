// Coverage instrumentation for the Garnet action.
//
// Jibril's network capture relies on kernel eBPF features (CO-RE/BTF via
// /sys/kernel/btf/vmlinux, cgroup v2 for cgroup/skb attachment). Alternative
// CI runner providers (Blacksmith, Namespace, Depot, WarpBuild, ...) boot
// custom guest kernels inside Firecracker/other microVMs where those features
// are not guaranteed. The daemon can stay "active" while individual probes
// silently fail, producing a record with process telemetry but zero outbound
// connections — coverage silently degrades.
//
// This module gives the action an explicit, honest signal:
//   1. main step  — collectRunnerEnvironment(): record kernel/BTF/cgroup/provider facts.
//   2. main step  — emitCanaryConnection(): make one known outbound connection
//                   while Jibril is recording, so every job has at least one
//                   expected connection in its record.
//   3. post step  — assessCoverage(): compare the parsed record against the
//                   canary and environment; classify full | degraded | none.
//
// The main-step probes (steps 1 and 2) live in src/coverage-probe.js so the
// post-step bundle carries only the assessment half.

/**
 * @typedef {{
 *   kernel: string
 *   btfPresent: boolean
 *   cgroupV2: boolean
 *   provider: string
 * }} RunnerEnvironment
 */

/**
 * @typedef {{
 *   status: "full" | "degraded" | "none"
 *   reasons: string[]
 *   destinations: number
 *   connections: number
 *   canaryObserved: boolean
 * }} CoverageAssessment
 */

/**
 * Serializes the runner environment into a single log-friendly line.
 * @param {RunnerEnvironment} environment
 * @returns {string}
 */
export function formatRunnerEnvironment(environment) {
    return (
        `kernel=${environment.kernel} ` +
        `btf=${environment.btfPresent ? "present" : "absent"} ` +
        `cgroup_v2=${environment.cgroupV2 ? "present" : "absent"} ` +
        `provider=${environment.provider}`
    )
}

/**
 * Returns the set of destination identities recorded in the job's
 * associations (names and addresses, lowercased).
 * @param {import("./runtime-review.js").JobRecord} record
 * @returns {Set<string>}
 */
function recordedDestinationIdentities(record) {
    const identities = new Set()
    for (const edge of record.edges) {
        for (const name of edge.remote_names) {
            if (name !== "") {
                identities.add(name.toLowerCase())
            }
        }
        if (edge.remote_address !== "") {
            identities.add(edge.remote_address.toLowerCase())
        }
    }
    return identities
}

/**
 * Distinct recorded destination addresses in the record.
 * @param {import("./runtime-review.js").JobRecord} record
 * @returns {number}
 */
function countDestinations(record) {
    const addresses = new Set()
    for (const edge of record.edges) {
        if (edge.remote_address !== "") {
            addresses.add(edge.remote_address)
        }
    }
    return addresses.size
}

/**
 * Inputs recorded by the main step for the post-step assessment.
 * @typedef {{
 *   canaryDomain: string
 *   environment: RunnerEnvironment | null
 * }} CoverageContext
 */

/**
 * Classifies runtime coverage for this job.
 *   - none:     no record was produced at all.
 *   - degraded: a record exists but outbound-connection capture is missing
 *               evidence it should have (zero destinations, or the canary
 *               connection is absent).
 *   - full:     outbound connections present and consistent with the canary.
 * @param {import("./runtime-review.js").JobRecord | null} record
 * @param {CoverageContext} context
 * @returns {CoverageAssessment}
 */
export function assessCoverage(record, context) {
    if (record === null) {
        return {
            status: "none",
            reasons: ["the Jibril daemon produced no record for this job"],
            destinations: 0,
            connections: 0,
            canaryObserved: false,
        }
    }

    const destinations = countDestinations(record)
    const connections = record.telemetry.total_connections !== null ? record.telemetry.total_connections : record.flow_count
    const identities = recordedDestinationIdentities(record)
    const canaryDomain = context.canaryDomain.toLowerCase()
    const canaryObserved = canaryDomain !== "" && identities.has(canaryDomain)

    const reasons = []
    if (identities.size === 0) {
        reasons.push("the record contains zero outbound connections")
    }
    if (canaryDomain !== "" && !canaryObserved && identities.size === 0) {
        reasons.push(
            `the canary connection to ${canaryDomain} (made while the daemon was recording) is absent from the record`,
        )
    }

    if (context.environment !== null && reasons.length > 0) {
        if (!context.environment.btfPresent) {
            reasons.push("kernel BTF (/sys/kernel/btf/vmlinux) is absent — eBPF CO-RE programs cannot load")
        }
        if (!context.environment.cgroupV2) {
            reasons.push("cgroup v2 is not mounted — cgroup/skb network probes cannot attach")
        }
    }

    return {
        status: reasons.length > 0 ? "degraded" : "full",
        reasons,
        destinations,
        connections,
        canaryObserved,
    }
}

/**
 * Renders the incomplete-capture banner prepended to the Garnet Execution
 * Summary when coverage is degraded.
 * @param {CoverageAssessment} assessment
 * @param {RunnerEnvironment | null} environment
 * @param {string} docsURL
 * @returns {string}
 */
export function renderCoverageBanner(assessment, environment, docsURL) {
    if (assessment.status !== "degraded") {
        return ""
    }

    const lines = [
        "> [!WARNING]",
        "> **Incomplete network recording** — the sensor ran and recorded this job's",
        "> processes, but outbound-connection capture looks incomplete on this runner:",
    ]
    for (const reason of assessment.reasons) {
        lines.push(`> - ${reason}`)
    }
    if (environment !== null) {
        lines.push(`> - runner environment: \`${formatRunnerEnvironment(environment)}\``)
    }
    lines.push(
        "> ",
        "> Process telemetry may still be present. This usually means the runner's",
        "> kernel lacks eBPF features the sensor needs (common on custom microVM",
        `> kernels used by alternative CI providers). See ${docsURL} for`,
        "> supported-runner requirements.",
    )
    return `${lines.join("\n")}\n\n`
}
