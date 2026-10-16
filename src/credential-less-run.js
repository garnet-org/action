// Called only when api_token resolved empty. Fork pull requests need
// remediation that does not expose credentials to untrusted code.

import * as fs from "node:fs/promises"
import { getEnv, getOptionalRecord, getOptionalString } from "./shared.js"

/**
 * - `authenticated`: register with the control plane as usual.
 * - `relay`: record locally and hand the run to the Garnet GitHub App
 *   through a workflow artifact.
 * - `skip`: nothing downstream would ever collect this run.
 * @typedef {"authenticated" | "relay" | "skip"} CredentialMode
 */

/**
 * @typedef {{
 *   mode: CredentialMode
 *   reason: string
 * }} CredentialDecision
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

// The relay exists to put a Runtime Review on a pull request; nothing
// downstream reads an artifact belonging to a push or a schedule.
const RELAY_EVENT_NAMES = new Set(["pull_request", "pull_request_target"])

/**
 * Decides how a run with no `api_token` proceeds. Never throws: the event
 * payload only refines the wording, so an unexpected shape or a read error
 * still yields a decision.
 * @param {CredentialSkipContext} context
 * @returns {Promise<CredentialDecision>}
 */
export async function resolveCredentialMode(context) {
    if (isOIDCAvailable()) {
        return { mode: "authenticated", reason: "OIDC is available" }
    }

    if (RELAY_EVENT_NAMES.has(context.eventName)) {
        const fromFork = await isForkPullRequest(context.eventPath, context.repository)
        return {
            mode: "relay",
            reason: fromFork
                ? "This pull request comes from a forked repository, which GitHub denies both repository secrets " +
                  "and an OIDC ID token, so this job cannot authenticate with Garnet. Jibril still records the " +
                  "job locally and the run is uploaded as a workflow artifact, which the Garnet GitHub App " +
                  "collects with its own credentials after the workflow finishes."
                : "No authentication mechanism was available: the 'api_token' input resolved empty and no OIDC " +
                  "ID token could be requested. Jibril still records this job locally and the run is uploaded " +
                  `as a workflow artifact for the Garnet GitHub App to collect. ${REMEDIATION}`,
        }
    }

    return {
        mode: "skip",
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
