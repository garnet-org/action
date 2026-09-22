// Called only when api_token resolved empty. Fork pull requests need
// remediation that does not expose credentials to untrusted code.

import * as fs from "node:fs/promises"
import { getEnv, getOptionalRecord, getOptionalString } from "./shared.js"

/**
 * @typedef {{
 *   skip: boolean
 *   reason: string
 * }} CredentialSkipDecision
 */

/**
 * @typedef {{
 *   eventName: string
 *   eventPath: string
 *   repository: string
 * }} CredentialSkipContext
 */

const REMEDIATION =
    "Grant 'id-token: write' to this job to authenticate with OIDC, or pass a Garnet API token to the 'api_token' input."

/**
 * Decides whether this run has no authentication mechanism at all and must
 * skip profiling. Callers invoke it only when the `api_token` input did not
 * resolve (empty), so the remaining question is whether the runtime granted
 * an OIDC ID-token endpoint.
 *
 * Detection never throws: the event payload only refines the wording, so an
 * unexpected shape or read error still yields a skip with the generic reason.
 *
 * @param {CredentialSkipContext} context
 * @returns {Promise<CredentialSkipDecision>}
 */
export async function resolveCredentialSkip(context) {
    if (isOIDCAvailable()) {
        return { skip: false, reason: "OIDC is available" }
    }

    const fromFork =
        context.eventName === "pull_request" && (await isForkPullRequest(context.eventPath, context.repository))

    if (fromFork) {
        return {
            skip: true,
            reason:
                "Garnet skipped this Runtime Review because no authentication mechanism was available: the " +
                "'api_token' input resolved empty and no OIDC ID token could be requested. For 'pull_request' " +
                "runs from forked repositories, adding 'id-token: write' does not by itself make credentials " +
                "available. Do not expose repository secrets to untrusted fork code. A maintainer can review " +
                "the change and run recording in an authorized, trusted workflow. The job continues normally.",
        }
    }

    return {
        skip: true,
        reason:
            "Garnet skipped this Runtime Review because no authentication mechanism was available: the " +
            "'api_token' input resolved empty and this job has no OIDC ID-token endpoint, which means " +
            `'id-token: write' permission was not granted. ${REMEDIATION} The job continues normally.`,
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
