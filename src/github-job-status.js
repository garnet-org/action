import * as core from "@actions/core"
import * as github from "@actions/github"
import { getErrorMessage } from "./shared.js"

/**
 * @typedef {object} JobStatusResolution
 * @property {string} status
 * @property {"github_api" | "unknown"} source
 */

/**
 * @typedef {object} JobStatusLookup
 * @property {string} token
 * @property {string} repository
 * @property {string} runID
 * @property {string} runAttempt
 * @property {string} runnerName
 * @property {string} jobName
 */

/**
 * @typedef {object} WorkflowRunJobStep
 * @property {string | null=} conclusion
 */

/**
 * @typedef {object} WorkflowRunJob
 * @property {string | null=} name
 * @property {string | null=} runner_name
 * @property {string=} status
 * @property {string | null=} conclusion
 * @property {WorkflowRunJobStep[]=} steps
 */

/**
 * Best-effort: resolves the current job's status from the workflow run's job
 * list. Fail-closed — any missing permission, ambiguity, or request failure
 * resolves to an empty status.
 * @param {JobStatusLookup} lookup
 * @returns {Promise<JobStatusResolution>}
 */
export async function resolveJobStatusFromGitHub(lookup) {
    const token = lookup.token.trim()
    const repository = lookup.repository.trim()
    const runID = lookup.runID.trim()
    const runAttempt = lookup.runAttempt.trim()

    if (token === "" || repository === "" || runID === "" || runAttempt === "") {
        return { status: "", source: "unknown" }
    }

    const [owner = "", repo = ""] = repository.split("/")
    if (owner === "" || repo === "") {
        return { status: "", source: "unknown" }
    }

    const attemptNumber = Number.parseInt(runAttempt, 10)
    if (!Number.isSafeInteger(attemptNumber) || attemptNumber <= 0) {
        return { status: "", source: "unknown" }
    }

    const numericRunID = Number.parseInt(runID, 10)
    if (!Number.isSafeInteger(numericRunID) || numericRunID <= 0) {
        return { status: "", source: "unknown" }
    }

    try {
        const octokit = github.getOctokit(token)
        const response = await octokit.rest.actions.listJobsForWorkflowRunAttempt({
            owner,
            repo,
            run_id: numericRunID,
            attempt_number: attemptNumber,
            per_page: 100,
            request: {
                signal: AbortSignal.timeout(5000),
            },
        })

        const jobs = response.data.jobs
        const status = deriveJobStatusFromJobs(jobs, {
            runnerName: lookup.runnerName,
            jobName: lookup.jobName,
        })
        if (status === "") {
            return { status: "", source: "unknown" }
        }

        return { status, source: "github_api" }
    } catch (error) {
        const statusCode = getStatusCode(error)
        if (statusCode === 403 || statusCode === 404) {
            core.info(`job-status GitHub API probe skipped: HTTP ${statusCode}`)
            return { status: "", source: "unknown" }
        }

        core.info(`job-status GitHub API probe skipped: ${getErrorMessage(error)}`)
        return { status: "", source: "unknown" }
    }
}

/**
 * @param {WorkflowRunJob[]} jobs
 * @param {{ runnerName: string, jobName: string }} selector
 * @returns {string}
 */
export function deriveJobStatusFromJobs(jobs, selector) {
    const runnerMatches = jobs.filter(job => job.runner_name === selector.runnerName && job.status === "in_progress")

    if (runnerMatches.length === 1) {
        const match = runnerMatches[0]
        if (match !== undefined) {
            return deriveJobStatusFromJob(match)
        }
    }

    const nameMatches = jobs.filter(job => job.name === selector.jobName)
    if (nameMatches.length === 1) {
        const match = nameMatches[0]
        if (match !== undefined) {
            return deriveJobStatusFromJob(match)
        }
    }

    return ""
}

/**
 * @param {WorkflowRunJob} job
 * @returns {string}
 */
function deriveJobStatusFromJob(job) {
    if (job.conclusion === "cancelled") {
        return "cancelled"
    }

    const steps = Array.isArray(job.steps) ? job.steps : []
    for (const step of steps) {
        if (step.conclusion === "cancelled") {
            return "cancelled"
        }
    }

    for (const step of steps) {
        if (step.conclusion === "failure") {
            return "failure"
        }
    }

    return ""
}

/**
 * @param {unknown} error
 * @returns {number}
 */
function getStatusCode(error) {
    if (typeof error !== "object" || error === null) {
        return 0
    }

    const maybeError = /** @type {{ status?: unknown }} */ (error)
    return typeof maybeError.status === "number" ? maybeError.status : 0
}
