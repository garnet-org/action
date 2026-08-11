// Fork pull request detection. GitHub never exposes repository secrets or
// grants `id-token: write` to `pull_request` runs from forked repositories,
// so those runs structurally cannot authenticate with the Garnet API. The
// action skips profiling gracefully in that case instead of erroring.
//
// `pull_request_target` runs DO receive secrets and must never be treated
// as credential-less; only the `pull_request` event is considered here.

import * as fs from "node:fs/promises"
import { getEnv, getOptionalRecord, getOptionalString } from "./shared.js"

/**
 * @typedef {{
 *   skip: boolean
 *   reason: string
 * }} ForkSkipDecision
 */

/**
 * Decides whether this run is a credential-less pull request from a fork
 * that should skip profiling gracefully. Callers invoke it only when the
 * `api_token` input did not resolve (empty).
 *
 * The skip applies only when OIDC is also unavailable (no runtime ID-token
 * grant) or the OIDC flag is off.
 *
 * Detection never throws: on unexpected payload shapes or read errors the
 * decision is "do not skip", which falls back to current behavior.
 *
 * @param {{
 *   eventName: string
 *   eventPath: string
 *   repository: string
 * }} context
 * @returns {Promise<ForkSkipDecision>}
 */
export async function resolveForkSkip(context) {
    if (context.eventName !== "pull_request") {
        return { skip: false, reason: `event is ${context.eventName || "unknown"}` }
    }

    if (isOIDCAvailable()) {
        return { skip: false, reason: "OIDC is available" }
    }

    const fromFork = await isForkPullRequest(context.eventPath, context.repository)
    if (!fromFork) {
        return { skip: false, reason: "pull request is not from a fork" }
    }

    return {
        skip: true,
        reason:
            "Garnet skips profiling on pull requests from forked repositories: " +
            "GitHub does not expose repository secrets or OIDC tokens to fork runs, " +
            "so no credentials are available. The job continues normally.",
    }
}

/**
 * Returns true when the runtime granted an OIDC ID-token endpoint and the
 * flag-gated OIDC auth path is enabled.
 * @returns {boolean}
 */
function isOIDCAvailable() {
    const flagEnabled = getEnv("GARNET_ACTION_ENABLE_OIDC_AUTH") === "true"
    const requestURL = getEnv("ACTIONS_ID_TOKEN_REQUEST_URL")
    const requestToken = getEnv("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    return flagEnabled && requestURL !== "" && requestToken !== ""
}

/**
 * Returns true when the pull request event payload records a head repository
 * different from the repository the workflow runs in. Never throws; any
 * read or shape problem yields false.
 * @param {string} eventPath
 * @param {string} repository
 * @returns {Promise<boolean>}
 */
async function isForkPullRequest(eventPath, repository) {
    if (eventPath === "" || repository === "") {
        return false
    }

    let payload
    try {
        payload = JSON.parse(await fs.readFile(eventPath, "utf8"))
    } catch {
        return false
    }

    const payloadRecord = getOptionalRecord(payload)
    if (payloadRecord === null) {
        return false
    }

    const pullRequest = getOptionalRecord(payloadRecord.pull_request)
    if (pullRequest === null) {
        return false
    }

    const head = getOptionalRecord(pullRequest.head)
    if (head === null) {
        return false
    }

    const headRepo = getOptionalRecord(head.repo)
    if (headRepo === null) {
        return false
    }

    const headRepoFullName = getOptionalString(headRepo.full_name)
    if (headRepoFullName === undefined) {
        return false
    }

    return headRepoFullName.toLowerCase() !== repository.toLowerCase()
}
