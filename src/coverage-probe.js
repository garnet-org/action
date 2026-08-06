import * as https from "node:https"
import * as os from "node:os"
import { getEnv, pathExists } from "./shared.js"

// Main-step half of the coverage instrumentation (see src/coverage.js for the
// post-step assessment). Kept in its own module so the post-step bundle does
// not carry the probe code: the main step records kernel facts and makes one
// known outbound connection while Jibril is recording, then hands both to the
// post step through the action state.

/** @typedef {import("./coverage.js").RunnerEnvironment} RunnerEnvironment */

const CANARY_TIMEOUT_MS = 5000

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
    } catch {
        environment.btfPresent = false
    }

    try {
        environment.cgroupV2 = await pathExists("/sys/fs/cgroup/cgroup.controllers")
    } catch {
        environment.cgroupV2 = false
    }

    return environment
}

/**
 * Makes one known outbound connection while Jibril is recording, via an HTTPS
 * request to the Garnet API host. The response status is irrelevant — the
 * TCP+TLS connection itself is the canary. Returns the canary hostname, or
 * "" when the connection could not be made (in which case the post step
 * skips the canary check rather than reporting a false degradation).
 * @param {string} baseURL
 * @returns {Promise<string>}
 */
export async function emitCanaryConnection(baseURL) {
    let hostname = ""
    try {
        hostname = new URL(baseURL).hostname
    } catch {
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
        // TLS handshake completing means the outbound connection happened even
        // if the request errors afterwards.
        request.on("error", () => resolve(""))
    })
}
