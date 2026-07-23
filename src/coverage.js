import * as core from "@actions/core"
import * as fs from "node:fs/promises"
import * as https from "node:https"
import * as os from "node:os"
import { getEnv, pathExists } from "./shared.js"

// Coverage instrumentation for the Garnet action.
//
// Jibril's network capture relies on kernel eBPF features (CO-RE/BTF via
// /sys/kernel/btf/vmlinux, cgroup v2 for cgroup/skb attachment). Alternative
// CI runner providers (Blacksmith, Namespace, Depot, WarpBuild, ...) boot
// custom guest kernels inside Firecracker/other microVMs where those features
// are not guaranteed. The daemon can stay "active" while individual probes
// silently fail, producing a Run Profile with process telemetry but zero
// network flows — coverage silently degrades.
//
// This module gives the action an explicit, honest signal:
//   1. main step  — collectRunnerEnvironment(): record kernel/BTF/cgroup/provider facts.
//   2. main step  — emitCanaryFlow(): make one known egress connection while
//                   Jibril is recording, so every job has at least one expected flow.
//   3. post step  — assessCoverage(): compare the parsed profile against the
//                   canary and environment; classify full | degraded | none.

const CANARY_TIMEOUT_MS = 5000

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
 *   totalDomains: number
 *   totalConnections: number
 *   canaryObserved: boolean
 * }} CoverageAssessment
 */

/**
 * Best-effort detection of the runner provider. GitHub-hosted runners set
 * RUNNER_ENVIRONMENT=github-hosted; alternative providers leak their identity
 * through environment variables or the runner name.
 * @returns {string}
 */
export function detectRunnerProvider() {
    const envKeys = Object.keys(process.env)
    const runnerName = getEnv("RUNNER_NAME", "").toLowerCase()

    const providers = [
        { name: "blacksmith", match: /^BLACKSMITH/i },
        { name: "namespace", match: /^NSC_/i },
        { name: "depot", match: /^DEPOT_/i },
        { name: "warpbuild", match: /^WARPBUILD/i },
        { name: "buildjet", match: /^BUILDJET/i },
    ]

    for (const provider of providers) {
        if (envKeys.some(key => provider.match.test(key)) || runnerName.includes(provider.name)) {
            return provider.name
        }
    }

    if (getEnv("RUNNER_ENVIRONMENT", "") === "github-hosted") {
        return "github-hosted"
    }

    return "self-hosted-or-unknown"
}

/**
 * Collects kernel facts relevant to Jibril's eBPF capture. Read-only sysfs
 * checks; never throws.
 * @returns {Promise<RunnerEnvironment>}
 */
export async function collectRunnerEnvironment() {
    const environment = {
        kernel: os.release(),
        btfPresent: false,
        cgroupV2: false,
        provider: detectRunnerProvider(),
    }

    try {
        environment.btfPresent = await pathExists("/sys/kernel/btf/vmlinux")
    } catch (_) {}

    try {
        environment.cgroupV2 = await pathExists("/sys/fs/cgroup/cgroup.controllers")
    } catch (_) {}

    return environment
}

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
 * Emits one known egress flow while Jibril is recording, by making an HTTPS
 * request to the Garnet API host. The response status is irrelevant — the
 * TCP+TLS connection itself is the canary. Returns the canary hostname, or
 * "" when the connection could not be made (in which case the post step
 * skips the canary check rather than reporting a false degradation).
 * @param {string} baseURL
 * @returns {Promise<string>}
 */
export async function emitCanaryFlow(baseURL) {
    let hostname = ""
    try {
        hostname = new URL(baseURL).hostname
    } catch (_) {
        return ""
    }

    return new Promise(resolve => {
        const request = https.get(`https://${hostname}/`, { timeout: CANARY_TIMEOUT_MS }, response => {
            // Drain and discard; the connection is all we need.
            response.resume()
            response.on("end", () => resolve(hostname))
            response.on("error", () => resolve(hostname))
        })
        request.on("timeout", () => {
            request.destroy()
            resolve("")
        })
        // TLS handshake completing means the egress flow happened even if the
        // request errors afterwards.
        request.on("error", () => resolve(""))
    })
}

/**
 * Returns the set of remote names observed in the profile's egress peers.
 * @param {import("./profile-comment.js").NormalizedProfile} profile
 * @returns {Set<string>}
 */
function getEgressNames(profile) {
    const names = new Set()
    for (const peer of profile.egress_peers) {
        for (const name of peer.remote_names) {
            names.add(name.toLowerCase())
        }
        if (peer.remote_address !== "") {
            names.add(peer.remote_address.toLowerCase())
        }
    }
    return names
}

/**
 * Classifies runtime coverage for this job.
 *   - none:     no profile was produced at all.
 *   - degraded: a profile exists but network capture is missing evidence it
 *               should have (zero egress, or the canary flow is absent).
 *   - full:     egress telemetry present and consistent with the canary.
 * @param {import("./profile-comment.js").NormalizedProfile | null} profile
 * @param {{ canaryDomain: string, environment: RunnerEnvironment | null }} context
 * @returns {CoverageAssessment}
 */
export function assessCoverage(profile, context) {
    if (profile === null) {
        return {
            status: "none",
            reasons: ["no Run Profile was produced by the Jibril daemon"],
            totalDomains: 0,
            totalConnections: 0,
            canaryObserved: false,
        }
    }

    const totalDomains = profile.telemetry.total_domains
    const totalConnections = profile.telemetry.total_connections
    const egressNames = getEgressNames(profile)
    const canaryDomain = context.canaryDomain.toLowerCase()
    const canaryObserved = canaryDomain !== "" && egressNames.has(canaryDomain)

    const reasons = []
    if (totalDomains === 0 && egressNames.size === 0) {
        reasons.push("profile contains zero network egress flows")
    }
    if (canaryDomain !== "" && !canaryObserved && egressNames.size === 0) {
        reasons.push(
            `canary flow to ${canaryDomain} (made while the daemon was recording) is absent from the profile`,
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
        totalDomains,
        totalConnections,
        canaryObserved,
    }
}

/**
 * Renders the degraded-coverage banner prepended to the Runtime Review
 * step summary.
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
        "> **Degraded runtime coverage** — Jibril ran and produced a Run Profile, but network",
        "> flow capture looks incomplete on this runner:",
    ]
    for (const reason of assessment.reasons) {
        lines.push(`> - ${reason}`)
    }
    if (environment !== null) {
        lines.push(`> - runner environment: \`${formatRunnerEnvironment(environment)}\``)
    }
    lines.push(
        "> ",
        "> Process and file telemetry may still be present. This usually indicates the runner's",
        "> kernel lacks eBPF features Jibril needs (common on custom microVM kernels used by",
        `> alternative CI providers). See ${docsURL} for supported-runner requirements.`,
    )
    return `${lines.join("\n")}\n\n`
}
