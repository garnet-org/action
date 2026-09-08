import * as core from "@actions/core"
import * as github from "@actions/github"
import { getErrorMessage } from "./shared.js"

export const COMMIT_STATUS_CONTEXT = "garnet/execution-receipt"

/**
 * @typedef {object} CommitStatusInput
 * @property {string} token
 * @property {string} repository
 * @property {string} sha
 * @property {string} description
 * @property {string} targetURL
 */

/**
 * @typedef {object} CreateCommitStatusParams
 * @property {string} owner
 * @property {string} repo
 * @property {string} sha
 * @property {"success"} state
 * @property {string} context
 * @property {string} description
 * @property {string} target_url
 * @property {{signal: AbortSignal}} request
 */

/**
 * @typedef {object} CommitStatusClient
 * @property {(params: CreateCommitStatusParams) => Promise<unknown>} createCommitStatus
 */

/**
 * @param {import("./garnet-status.js").GarnetStatus} status
 * @param {number} jobCount
 * @returns {string}
 */
export function describeCommitStatus(status, jobCount) {
    if (status === "recorded") {
        return `recorded · ${jobCount} ${jobCount === 1 ? "job" : "jobs"}`
    }
    return `not recorded · ${status}`
}

/**
 * Creates the garnet/execution-receipt commit status. It is a receipt, not a
 * gate: state is always "success". Fail-open throughout — a missing token,
 * insufficient permission, or any API error produces one info line and a
 * "skipped" result; this function never warns and never throws.
 * @param {CommitStatusInput} input
 * @param {CommitStatusClient=} client
 * @returns {Promise<"created" | "skipped">}
 */
export async function createExecutionReceiptStatus(input, client) {
    const token = input.token
    if (token === "") {
        core.info(
            "commit status skipped: no github token; grant `statuses: write` and pass `github_token` to publish the " +
                `${COMMIT_STATUS_CONTEXT} status`,
        )
        return "skipped"
    }

    const [owner = "", repo = ""] = input.repository.split("/")
    if (owner === "" || repo === "") {
        core.info(`commit status skipped: cannot resolve owner/repo from '${input.repository}'`)
        return "skipped"
    }

    const statusClient =
        client !== undefined
            ? client
            : {
                  /**
                   * @param {CreateCommitStatusParams} params
                   * @returns {Promise<unknown>}
                   */
                  createCommitStatus: params => github.getOctokit(token).rest.repos.createCommitStatus(params),
              }

    try {
        await statusClient.createCommitStatus({
            owner,
            repo,
            sha: input.sha,
            state: "success",
            context: COMMIT_STATUS_CONTEXT,
            description: input.description,
            target_url: input.targetURL,
            request: {
                signal: AbortSignal.timeout(5000),
            },
        })
        return "created"
    } catch (error) {
        const statusCode = getHTTPStatusCode(error)
        if (statusCode === 403 || statusCode === 404) {
            core.info(
                "commit status skipped: the workflow token cannot create commit statuses (needs statuses: write) — " +
                    `${COMMIT_STATUS_CONTEXT}: ${input.description}`,
            )
        } else {
            core.info(`commit status skipped: ${getErrorMessage(error)}`)
        }
        return "skipped"
    }
}

/**
 * @param {unknown} error
 * @returns {number | null}
 */
function getHTTPStatusCode(error) {
    if (typeof error === "object" && error !== null && "status" in error) {
        const status = error.status
        if (typeof status === "number") {
            return status
        }
    }
    return null
}
