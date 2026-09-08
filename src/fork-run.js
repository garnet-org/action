// Credential-less run detection. Two run shapes structurally cannot
// authenticate with the Garnet API, and the action skips profiling gracefully
// for both instead of erroring:
//
// - `pull_request` runs from forked repositories: GitHub exposes neither
//   repository secrets nor an `id-token: write` grant to them.
// - Runs triggered by Dependabot: GitHub populates `secrets.*` from the
//   repository's separate Dependabot secrets store, so an `api_token` wired to
//   an Actions secret resolves empty. When the run also carries no OIDC
//   grant, there is no credential path left.
//
// `pull_request_target` runs DO receive secrets and must never be treated
// as credential-less; only the `pull_request` event is considered for forks.

import * as fs from "node:fs/promises"
import { getEnv, getOptionalRecord, getOptionalString } from "./shared.js"

const DEPENDABOT_ACTOR = "dependabot[bot]"

/**
 * @typedef {{
 *   skip: boolean
 *   reason: string
 * }} ForkSkipDecision
 */

/**
 * @typedef {{
 *   eventName: string
 *   eventPath: string
 *   repository: string
 *   actor: string
 * }} CredentialLessRunContext
 */

/**
 * Decides whether this run has no path to Garnet credentials at all and should
 * skip profiling gracefully. Callers invoke it only when the `api_token` input
 * did not resolve (empty); a runtime OIDC grant always means "do not skip".
 *
 * The Dependabot shape is checked first: a Dependabot pull request is a
 * same-repository branch, so the fork check alone would let it fall through
 * to the hard `api_token` error.
 *
 * @param {CredentialLessRunContext} context
 * @returns {Promise<ForkSkipDecision>}
 */
export async function resolveCredentialLessSkip(context) {
    if (context.actor === DEPENDABOT_ACTOR && !isOIDCAvailable()) {
        return {
            skip: true,
            reason:
                "Garnet skips profiling on this Dependabot-triggered run: GitHub resolves `secrets.*` from the " +
                "repository's Dependabot secrets store and this run has no OIDC grant, so no credentials are available. " +
                "To record Dependabot runs, add the Garnet API token to the repository's Dependabot secrets under " +
                "the same name. The job continues normally.",
        }
    }

    return resolveForkSkip(context)
}

/**
 * Decides whether this run is a credential-less pull request from a fork
 * that should skip profiling gracefully. Callers invoke it only when the
 * `api_token` input did not resolve (empty).
 *
 * The skip applies only when OIDC is also unavailable (no runtime ID-token
 * grant).
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
 * Returns true when the runtime granted an OIDC ID-token endpoint.
 * @returns {boolean}
 */
function isOIDCAvailable() {
    const requestURL = getEnv("ACTIONS_ID_TOKEN_REQUEST_URL")
    const requestToken = getEnv("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    return requestURL !== "" && requestToken !== ""
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
