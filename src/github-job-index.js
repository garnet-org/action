import * as core from "@actions/core"
import * as github from "@actions/github"
import { getErrorMessage } from "./shared.js"

/**
 * @typedef {object} JobIndexLookup
 * @property {string} token
 * @property {string} repository
 * @property {string} runID
 * @property {string} runAttempt
 * @property {string} runnerName
 */

/**
 * @typedef {object} WorkflowRunJobIdentity
 * @property {number=} id
 * @property {string | null=} name
 * @property {string | null=} runner_name
 * @property {string=} status
 */

/**
 * Best-effort recovery of `strategy.job-index` for callers that did not pass
 * the `job_index` input. GitHub exposes no matrix position anywhere in the
 * runner environment or the REST API, so this reconstructs it from the run's
 * job list. Fail-closed: anything ambiguous yields null and the leg stays
 * unidentified, which degrades the Runtime Review rather than corrupting it.
 * @param {JobIndexLookup} lookup
 * @returns {Promise<number | null>}
 */
export async function resolveJobIndexFromGitHub(lookup) {
    const token = lookup.token.trim()
    const repository = lookup.repository.trim()
    const runnerName = lookup.runnerName.trim()

    if (token === "" || runnerName === "") {
        return null
    }

    const [owner = "", repo = ""] = repository.trim().split("/")
    if (owner === "" || repo === "") {
        return null
    }

    const runID = Number.parseInt(lookup.runID.trim(), 10)
    const attemptNumber = Number.parseInt(lookup.runAttempt.trim(), 10)
    if (!Number.isSafeInteger(runID) || runID <= 0 || !Number.isSafeInteger(attemptNumber) || attemptNumber <= 0) {
        return null
    }

    try {
        const octokit = github.getOctokit(token)
        const response = await octokit.rest.actions.listJobsForWorkflowRunAttempt({
            owner,
            repo,
            run_id: runID,
            attempt_number: attemptNumber,
            per_page: 100,
            request: {
                signal: AbortSignal.timeout(5000),
            },
        })

        return deriveJobIndexFromJobs(response.data.jobs, runnerName)
    } catch (error) {
        const statusCode = getStatusCode(error)
        if (statusCode === 403 || statusCode === 404) {
            core.info(`job-index GitHub API probe skipped: HTTP ${statusCode} (needs \`actions: read\`)`)
            return null
        }

        core.info(`job-index GitHub API probe skipped: ${getErrorMessage(error)}`)
        return null
    }
}

/**
 * A matrix leg's position among its siblings, ordered by job id. Legs of one
 * matrix are created together when the run is queued, so ascending id follows
 * expansion order — except after a re-run of individual jobs, which mints new
 * ids for only the legs that were re-run. The index can be wrong there, and
 * nothing in the response distinguishes that case.
 * @param {WorkflowRunJobIdentity[]} jobs
 * @param {string} runnerName
 * @returns {number | null}
 */
export function deriveJobIndexFromJobs(jobs, runnerName) {
    const running = jobs.filter(job => job.runner_name === runnerName && job.status === "in_progress")
    const self = running.length === 1 ? running[0] : undefined
    if (self === undefined || typeof self.id !== "number") {
        return null
    }

    const base = matrixBaseName(self.name)
    if (base === null) {
        return null
    }

    const siblings = jobs.filter(job => typeof job.id === "number" && matrixBaseName(job.name) === base)

    // One leg has nothing to be disambiguated from, and a job merely named
    // "Build (fast)" would otherwise be reported as matrix leg 0.
    if (siblings.length < 2) {
        return null
    }

    // Duplicate display names leave no way to order the legs, and guessing
    // would alias one leg's history onto another's.
    const names = new Set(siblings.map(job => job.name))
    if (names.size !== siblings.length) {
        return null
    }

    siblings.sort((left, right) => Number(left.id) - Number(right.id))
    return siblings.findIndex(job => job.id === self.id)
}

/**
 * Strips the ` (<matrix values>)` suffix GitHub appends to every matrix leg's
 * display name, returning null when the name carries no suffix.
 * @param {string | null | undefined} name
 * @returns {string | null}
 */
function matrixBaseName(name) {
    if (typeof name !== "string" || !name.endsWith(")")) {
        return null
    }

    const suffixStart = name.lastIndexOf(" (")
    return suffixStart <= 0 ? null : name.slice(0, suffixStart)
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
