import { z } from "zod"
import {
    buildRunReview,
    renderRunReview,
    summarizeProfile,
    COMMENT_MARKER,
    RUNTIME_REVIEW_MARKER,
} from "./runtime-review.js"

/** @typedef {import("./runtime-review.js").RunReview} RunReview */
/** @typedef {import("./runtime-review.js").JobRecord} JobRecord */
/** @typedef {import("./runtime-review.js").Edge} Edge */

export const ACTION_COMMENT_MARKER = "garnet-action-pr-comment:v1"
export const COMMIT_MARKER_PREFIX = "garnet-pr-commit:"
export const LEGACY_COMMENT_STATE_MARKER = "garnet-runtime-visibility"

const COMMENT_STATE_MARKER_PREFIX = "garnet-action-comment-state:"

/**
 * @typedef {{
 *   run_id: string
 *   run_attempt: number
 * }} WorkflowRun
 */

/**
 * @typedef {{ kind: "stale" } | { kind: "updated", state: CommentState }} MergeCommentStateResult
 */

/**
 * @typedef {{
 *   repository: string
 *   run_id: string
 *   job: string
 * }} ReportLinkInput
 */

/**
 * The comment state carried in the state marker (version 3): one collapsed
 * job record per workflow/job, in the renderer's own shape. Versions 1 and 2
 * carried normalized profiles from the pre-v6.6.1 renderer; both upgrade in
 * place so an existing comment updates instead of duplicating.
 * @typedef {{
 *   version: 3
 *   workflow_runs: Record<string, WorkflowRun>
 *   jobs: JobRecord[]
 * }} CommentState
 */

/**
 * Rendering knobs threaded from the publish flow (all optional, additive).
 * @typedef {{
 *   explainerOpen?: boolean
 * }} RenderOptions
 */

const DEFAULT_JSON_PROFILE_FILE = "/var/log/jibril.profile.json"
const DEFAULT_APP_BASE_URL = "https://app.garnet.ai"

const WORKFLOW_RUN_SCHEMA = z.object({
    run_id: z.string(),
    run_attempt: z.number(),
})

const EDGE_SCHEMA = z.object({
    flow_id: z.number(),
    tree_index: z.number(),
    remote_address: z.string(),
    remote_names: z.array(z.string()),
    remote_ports: z.array(z.string()),
    protocol: z.string(),
    result: z.string(),
    detections: z.array(z.string()),
    lineage_recorded: z.boolean(),
    pid: z.string(),
    process: z.string(),
    ancestry: z.array(z.string()),
    github_step: z.string(),
})

const JOB_RECORD_SCHEMA = z.object({
    name: z.string(),
    workflow: z.string(),
    repository: z.string(),
    sha: z.string(),
    run_id: z.string(),
    run_url: z.string(),
    job_url: z.string(),
    profile_id: z.string(),
    uuid: z.string(),
    timestamp: z.string(),
    ref: z.string(),
    actor: z.string(),
    job_index: z.string(),
    flow_count: z.number(),
    telemetry: z.object({
        total_domains: z.number().nullable(),
        total_connections: z.number().nullable(),
    }),
    assertions: z.array(z.unknown()).transform(() => /** @type {import("./runtime-review.js").AssertionRecord[]} */ ([])),
    edges: z.array(EDGE_SCHEMA),
})

const COMMENT_STATE_SCHEMA = z.object({
    version: z.literal(3),
    workflow_runs: z.record(z.string(), WORKFLOW_RUN_SCHEMA),
    jobs: z.array(JOB_RECORD_SCHEMA),
})

// Versions 1 and 2 carried normalized profiles (the pre-v6.6.1 comment
// state). Their shared profile shape upgrades to a job record, so an
// existing managed comment keeps updating in place across the renderer
// migration instead of gaining a duplicate.
const LEGACY_GITHUB_SCENARIO_SCHEMA = z.object({
    workflow: z.string(),
    repository: z.string(),
    ref: z.string(),
    sha: z.string(),
    actor: z.string(),
    run_id: z.string(),
    job: z.string(),
})

const LEGACY_PROFILE_SCHEMA = z.looseObject({
    timestamp: z.string(),
    github: LEGACY_GITHUB_SCENARIO_SCHEMA,
    egress_peers: z.array(
        z.looseObject({
            remote_names: z.array(z.string()),
            remote_address: z.string().optional(),
            proc_trees: z.array(z.looseObject({ ancestry: z.array(z.string()) })),
        }),
    ),
    telemetry: z.object({
        total_domains: z.number(),
        total_connections: z.number(),
    }),
})

const LEGACY_COMMENT_STATE_V1_SCHEMA = z.object({
    version: z.literal(1),
    latest_run: WORKFLOW_RUN_SCHEMA,
    profiles: z.array(LEGACY_PROFILE_SCHEMA),
})

const LEGACY_COMMENT_STATE_V2_SCHEMA = z.object({
    version: z.literal(2),
    workflow_runs: z.record(z.string(), WORKFLOW_RUN_SCHEMA),
    profiles: z.array(LEGACY_PROFILE_SCHEMA),
})

/** @typedef {z.infer<typeof LEGACY_PROFILE_SCHEMA>} LegacyProfile */

/**
 * @returns {string}
 */
export function getDefaultJsonProfileFile() {
    const configuredFile = process.env.JIBRIL_JSONPROFILER_FILE
    if (typeof configuredFile === "string" && configuredFile !== "") {
        return configuredFile
    }

    return DEFAULT_JSON_PROFILE_FILE
}

const PROFILE_JSON_GATE_SCHEMA = z.looseObject({
    timestamp: z.string(),
    scenarios: z.object({
        github: LEGACY_GITHUB_SCENARIO_SCHEMA.loose(),
    }),
})

/**
 * Parse the Jibril JSON profile into a collapsed job record. The gate schema
 * validates the identity fields the publish flow depends on; the record
 * collapse itself is tolerant of optional sections.
 * @param {string} content
 * @returns {JobRecord}
 */
export function parseProfileJson(content) {
    const parsedContent = JSON.parse(content)
    const result = PROFILE_JSON_GATE_SCHEMA.safeParse(parsedContent)
    if (!result.success) {
        const issues = result.error.issues.map(issue => {
            const path = issue.path.length > 0 ? issue.path.join(".") : "<root>"
            return `${path}: ${issue.message}`
        })
        throw new Error(`Invalid profile JSON: ${issues.join("; ")}`)
    }

    const job = summarizeProfile(parsedContent)
    if (job === null) {
        throw new Error("Invalid profile JSON: not an object")
    }

    return job
}

/**
 * @param {CommentState | null} existingState
 * @param {JobRecord} incomingJob
 * @param {number} runAttempt
 * @returns {MergeCommentStateResult}
 */
export function mergeCommentState(existingState, incomingJob, runAttempt) {
    const incomingRunID = incomingJob.run_id
    const incomingRunAttempt = Number.isSafeInteger(runAttempt) ? runAttempt : 1
    const workflowKey = getWorkflowKey(incomingJob)

    if (incomingRunID === "") {
        throw new Error("profile JSON is missing the GitHub run id")
    }

    if (existingState === null) {
        return {
            kind: "updated",
            state: {
                version: 3,
                workflow_runs: {
                    [workflowKey]: {
                        run_id: incomingRunID,
                        run_attempt: incomingRunAttempt,
                    },
                },
                jobs: [incomingJob],
            },
        }
    }

    const latestRun = existingState.workflow_runs[workflowKey] ?? null
    const comparison =
        latestRun === null
            ? -1
            : compareRuns(latestRun, {
                  run_id: incomingRunID,
                  run_attempt: incomingRunAttempt,
              })

    if (comparison > 0) {
        return { kind: "stale" }
    }

    if (comparison < 0) {
        return {
            kind: "updated",
            state: {
                version: 3,
                workflow_runs: {
                    ...existingState.workflow_runs,
                    [workflowKey]: {
                        run_id: incomingRunID,
                        run_attempt: incomingRunAttempt,
                    },
                },
                jobs: [...existingState.jobs.filter(job => getWorkflowKey(job) !== workflowKey), incomingJob].sort(
                    compareJobs,
                ),
            },
        }
    }

    const jobs = existingState.jobs.filter(job => getJobKey(job) !== getJobKey(incomingJob))
    jobs.push(incomingJob)
    jobs.sort(compareJobs)

    return {
        kind: "updated",
        state: {
            version: 3,
            workflow_runs: existingState.workflow_runs,
            jobs,
        },
    }
}

/**
 * @param {CommentState[]} states
 * @returns {CommentState | null}
 */
export function mergeCommentStates(states) {
    if (states.length === 0) {
        return null
    }

    /** @type {Record<string, WorkflowRun>} */
    const workflowRuns = {}

    for (const state of states) {
        for (const [workflowKey, workflowRun] of Object.entries(state.workflow_runs)) {
            const existingRun = workflowRuns[workflowKey] ?? null
            if (existingRun === null || compareRuns(existingRun, workflowRun) < 0) {
                workflowRuns[workflowKey] = workflowRun
            }
        }
    }

    /** @type {Map<string, JobRecord>} */
    const jobs = new Map()

    for (const state of states) {
        for (const job of state.jobs) {
            const workflowKey = getWorkflowKey(job)
            const workflowRun = state.workflow_runs[workflowKey] ?? null
            const latestRun = workflowRuns[workflowKey] ?? null
            if (workflowRun === null || latestRun === null || compareRuns(workflowRun, latestRun) !== 0) {
                continue
            }

            jobs.set(getJobKey(job), job)
        }
    }

    return {
        version: 3,
        workflow_runs: workflowRuns,
        jobs: [...jobs.values()].sort(compareJobs),
    }
}

/**
 * Render the Garnet execution PR comment body. The runtime-review marker is
 * the FIRST line (canonical sticky marker), followed by the action's own
 * state markers, then the rendered review.
 * @param {CommentState} state
 * @param {RenderOptions} [options]
 * @returns {string}
 */
export function renderCommentBody(state, options = {}) {
    const metadata = encodeCommentState(state)
    const jobs = [...state.jobs].sort(compareJobs)
    const commitSha = getCommentCommitSha(jobs)
    const review = buildProfileRunReview(jobs)
    const reviewBody = renderRunReview(review, { explainerOpen: options.explainerOpen === true })

    const markerPrefix = `${RUNTIME_REVIEW_MARKER}\n${COMMENT_MARKER}\n`
    if (!reviewBody.startsWith(markerPrefix)) {
        throw new Error("rendered review body is missing the runtime-review markers")
    }

    return [
        RUNTIME_REVIEW_MARKER,
        COMMENT_MARKER,
        `<!-- ${ACTION_COMMENT_MARKER} -->`,
        `<!-- ${COMMIT_MARKER_PREFIX}${commitSha} -->`,
        `<!-- ${COMMENT_STATE_MARKER_PREFIX}${metadata} -->`,
        reviewBody.slice(markerPrefix.length),
    ].join("\n")
}

/**
 * Build the run review from collapsed job records (one per job). Shared by
 * the PR comment and the Step Summary so both surfaces render from the same
 * review model.
 * @param {JobRecord[]} jobs
 * @returns {RunReview}
 */
export function buildProfileRunReview(jobs) {
    const sha = getCommentCommitSha(jobs)
    const repository = getCommentRepository(jobs)
    const commitURL = repository !== "" && sha !== "" ? `https://github.com/${repository}/commit/${sha}` : ""

    return buildRunReview({
        repo: repository,
        sha,
        commitURL,
        appURL: resolveAppBaseURL(),
        jobs,
    })
}

/**
 * @param {JobRecord[]} jobs
 * @returns {string}
 */
function getCommentRepository(jobs) {
    for (const job of jobs) {
        if (job.repository !== "") {
            return job.repository
        }
    }

    return ""
}

/**
 * @param {string} body
 * @returns {CommentState | null}
 */
export function parseCommentState(body) {
    const encoded =
        parseCommentMarkerValue(body, COMMENT_STATE_MARKER_PREFIX) ??
        parseCommentMarkerValue(body, `${LEGACY_COMMENT_STATE_MARKER}:`)
    if (encoded === null) {
        return null
    }

    try {
        const json = Buffer.from(encoded, "base64url").toString("utf8")
        const parsed = JSON.parse(json)
        const result = COMMENT_STATE_SCHEMA.safeParse(parsed)
        if (result.success) {
            return result.data
        }

        const legacyV2 = LEGACY_COMMENT_STATE_V2_SCHEMA.safeParse(parsed)
        if (legacyV2.success) {
            return {
                version: 3,
                workflow_runs: legacyV2.data.workflow_runs,
                jobs: legacyV2.data.profiles.map(upgradeLegacyProfile).sort(compareJobs),
            }
        }

        const legacyV1 = LEGACY_COMMENT_STATE_V1_SCHEMA.safeParse(parsed)
        if (legacyV1.success) {
            /** @type {Record<string, WorkflowRun>} */
            const workflowRuns = {}
            const jobs = legacyV1.data.profiles.map(upgradeLegacyProfile).sort(compareJobs)
            for (const job of jobs) {
                workflowRuns[getWorkflowKey(job)] = legacyV1.data.latest_run
            }
            return { version: 3, workflow_runs: workflowRuns, jobs }
        }

        return null
    } catch {
        return null
    }
}

/**
 * Upgrade a version-1/2 normalized profile to a collapsed job record. Fields
 * the old state never carried (ports, protocol, detections, step
 * attribution, PID) upgrade empty; the next run of that job replaces the
 * record wholesale.
 * @param {LegacyProfile} profile
 * @returns {JobRecord}
 */
function upgradeLegacyProfile(profile) {
    /** @type {Edge[]} */
    const edges = []
    profile.egress_peers.forEach((peer, flowID) => {
        const trees = peer.proc_trees.length > 0 ? peer.proc_trees : [null]
        trees.forEach((tree, treeIndex) => {
            edges.push({
                flow_id: flowID,
                tree_index: treeIndex,
                remote_address: peer.remote_address ?? "",
                remote_names: peer.remote_names,
                remote_ports: [],
                protocol: "",
                result: "",
                detections: [],
                lineage_recorded: tree !== null,
                pid: "",
                process: "",
                ancestry: tree !== null ? tree.ancestry : [],
                github_step: "",
            })
        })
    })

    return {
        name: profile.github.job,
        workflow: profile.github.workflow,
        repository: profile.github.repository,
        sha: profile.github.sha,
        run_id: profile.github.run_id,
        run_url: buildGitHubRunLink(profile.github.repository, profile.github.run_id),
        job_url: "",
        profile_id: "",
        uuid: "",
        timestamp: profile.timestamp,
        ref: profile.github.ref,
        actor: profile.github.actor,
        job_index: "",
        flow_count: profile.egress_peers.length,
        telemetry: {
            total_domains: profile.telemetry.total_domains,
            total_connections: profile.telemetry.total_connections,
        },
        assertions: [],
        edges,
    }
}

/**
 * @param {CommentState} state
 * @returns {string}
 */
function encodeCommentState(state) {
    return Buffer.from(JSON.stringify(state), "utf8").toString("base64url")
}

/**
 * @param {string} body
 * @param {string} markerPrefix
 * @returns {string | null}
 */
function parseCommentMarkerValue(body, markerPrefix) {
    const marker = `<!-- ${markerPrefix}`
    const start = body.indexOf(marker)
    if (start === -1) {
        return null
    }

    const end = body.indexOf("-->", start)
    if (end === -1) {
        return null
    }

    return body.slice(start + marker.length, end).trim()
}

/**
 * @param {JobRecord[]} jobs
 * @returns {string}
 */
function getCommentCommitSha(jobs) {
    for (const job of jobs) {
        if (job.sha !== "") {
            return job.sha
        }
    }

    return ""
}

/**
 * The `report_url` output: the run's Execution Profile on the Garnet app.
 * The exact `?profile=` selector needs the control-plane envelope
 * Profile.ID, which is unknown when this output is emitted (the main step
 * runs before the sensor records anything), so the output is the
 * `/dashboard/runs/<run-id>` run route — the app resolves it server-side
 * and redirects logged-out visitors to the public run route. The output URL
 * carries no UTM parameters: the contract's mediums (`pr_comment`,
 * `step_summary`) name rendered surfaces, and this output is neither.
 * @param {ReportLinkInput} values
 * @returns {string}
 */
export function buildReportLink(values) {
    const baseURL = resolveAppBaseURL()
    if (values.run_id === "") {
        return baseURL
    }

    return `${baseURL}/dashboard/runs/${encodeURIComponent(values.run_id)}`
}

/**
 * @param {string} repository
 * @param {string} runID
 * @returns {string}
 */
function buildGitHubRunLink(repository, runID) {
    const repositoryPath = repository
        .split("/")
        .filter(part => part !== "")
        .map(part => encodeURIComponent(part))
        .join("/")

    if (repositoryPath === "" || !repositoryPath.includes("/") || runID === "") {
        return ""
    }

    return `https://github.com/${repositoryPath}/actions/runs/${encodeURIComponent(runID)}`
}

/**
 * @returns {string}
 */
export function resolveAppBaseURL() {
    const apiURL = getConfiguredApiURL()
    if (apiURL === "") {
        return DEFAULT_APP_BASE_URL
    }

    try {
        const url = new URL(apiURL)
        const appHost = mapApiHostToAppHost(url.host)
        return `${url.protocol}//${appHost}`
    } catch {
        return DEFAULT_APP_BASE_URL
    }
}

/**
 * @returns {string}
 */
function getConfiguredApiURL() {
    if (typeof process.env.GARNET_API_URL === "string" && process.env.GARNET_API_URL !== "") {
        return process.env.GARNET_API_URL
    }

    if (typeof process.env.INPUT_API_URL === "string" && process.env.INPUT_API_URL !== "") {
        return process.env.INPUT_API_URL
    }

    return ""
}

/**
 * @param {string} host
 * @returns {string}
 */
function mapApiHostToAppHost(host) {
    if (host === "dev-api.garnet.ai") {
        return "dev-app.garnet.ai"
    }
    if (host === "staging-api.garnet.ai") {
        return "staging-app.garnet.ai"
    }
    if (host === "api.garnet.ai") {
        return "app.garnet.ai"
    }

    return host
}

/**
 * @param {WorkflowRun} left
 * @param {WorkflowRun} right
 * @returns {number}
 */
function compareRuns(left, right) {
    const leftRunID = toBigInt(left.run_id)
    const rightRunID = toBigInt(right.run_id)
    if (leftRunID > rightRunID) {
        return 1
    }
    if (leftRunID < rightRunID) {
        return -1
    }

    if (left.run_attempt > right.run_attempt) {
        return 1
    }
    if (left.run_attempt < right.run_attempt) {
        return -1
    }

    return 0
}

/**
 * @param {JobRecord} job
 * @returns {string}
 */
function getWorkflowKey(job) {
    return getDisplayValue(job.workflow, "unknown-workflow")
}

/**
 * @param {JobRecord} job
 * @returns {string}
 */
function getJobKey(job) {
    return `${getWorkflowKey(job)}\u0000${getDisplayValue(job.name, "unknown-job")}`
}

/**
 * @param {JobRecord} left
 * @param {JobRecord} right
 * @returns {number}
 */
function compareJobs(left, right) {
    const workflowCompare = getWorkflowKey(left).localeCompare(getWorkflowKey(right))
    if (workflowCompare !== 0) {
        return workflowCompare
    }

    return left.name.localeCompare(right.name)
}

/**
 * @param {string} value
 * @returns {bigint}
 */
function toBigInt(value) {
    try {
        return BigInt(value)
    } catch {
        return 0n
    }
}

/**
 * @param {string} value
 * @param {string} fallback
 * @returns {string}
 */
function getDisplayValue(value, fallback) {
    return value !== "" ? value : fallback
}
