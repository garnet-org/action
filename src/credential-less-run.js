// Credential-less run detection. The action authenticates with GitHub OIDC
// first and falls back to the `api_token` input; a run that offers neither
// cannot reach the control plane at all. Such a run skips profiling instead
// of failing the job, but the skip must always name the credential that was
// missing — a silent no-op is indistinguishable from a broken action.
//
// `pull_request` runs from forked repositories are the common case (GitHub
// exposes neither repository secrets nor an ID token to them), so they get
// their own wording. Every other credential-less shape gets the generic
// wording; `pull_request_target` is not special-cased, because by the time
// this runs the `api_token` input has already resolved empty.

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
                "'api_token' input resolved empty and no OIDC ID token could be requested. GitHub exposes " +
                "neither repository secrets nor an 'id-token: write' grant to 'pull_request' runs from forked " +
                `repositories. ${REMEDIATION} The job continues normally.`,
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
