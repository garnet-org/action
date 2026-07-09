import { z } from "zod"
import { getOptionalRecord } from "./shared.js"
import {
    buildRunReview,
    derivePermalink,
    renderRunReview,
    COMMENT_MARKER,
    RUNTIME_REVIEW_MARKER,
} from "./runtime-review.js"

/** @typedef {import("./runtime-review.js").RunReview} RunReview */
/** @typedef {import("./runtime-review.js").JobRecord} JobRecord */

export const ACTION_COMMENT_MARKER = "garnet-action-pr-comment:v1"
export const COMMIT_MARKER_PREFIX = "garnet-pr-commit:"
export const LEGACY_COMMENT_STATE_MARKER = "garnet-runtime-visibility"

const COMMENT_STATE_MARKER_PREFIX = "garnet-action-comment-state:"

/**
 * @typedef {"pass" | "attention" | "fail" | "unknown"} ProfileResult
 */

/**
 * @typedef {{
 *   workflow: string
 *   repository: string
 *   ref: string
 *   sha: string
 *   actor: string
 *   run_id: string
 *   job: string
 * }} GitHubScenario
 */

/**
 * @typedef {{ ancestry: string[] }} ProcTree
 */

/**
 * @typedef {{ ancestry?: unknown }} ProcTreeTransformInput
 */

/**
 * @typedef {{
 *   result: ProfileResult
 *   remote_names?: unknown
 *   remote_address?: string | undefined
 *   proc_trees?: unknown
 * }} PeerTransformInput
 */

/**
 * @typedef {{
 *   timestamp: string
 *   scenarios: { github: GitHubScenario }
 *   assertions: AssertionSummary[]
 *   network?: unknown
 *   telemetry?: unknown
 * }} ProfileJsonTransformInput
 */

/**
 * @typedef {{
 *   remote_names: string[]
 *   remote_address: string
 *   proc_trees: ProcTree[]
 *   result: ProfileResult
 * }} EgressPeer
 */

/**
 * @typedef {{
 *   total_domains: number
 *   total_connections: number
 * }} NetworkTelemetry
 */

/**
 * @typedef {{
 *   id: string
 *   result: ProfileResult
 * }} AssertionSummary
 */

/**
 * @typedef {{
 *   timestamp: string
 *   github: GitHubScenario
 *   assertions: AssertionSummary[]
 *   egress_peers: EgressPeer[]
 *   telemetry: NetworkTelemetry
 *   report_link: string
 * }} NormalizedProfile
 */

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
 * @typedef {{
 *   ancestry: string[]
 *   domain: string
 *   ip: string
 * }} ProfileConnection
 */

/**
 * @typedef {{
 *   version: 1
 *   latest_run: WorkflowRun
 *   profiles: NormalizedProfile[]
 * }} LegacyCommentState
 */

/**
 * @typedef {{
 *   version: 2
 *   workflow_runs: Record<string, WorkflowRun>
 *   profiles: NormalizedProfile[]
 * }} CommentState
 */

/**
 * Rendering knobs threaded from the action's inputs (all optional, additive).
 * @typedef {{
 *   expectedJobs?: number
 *   permalinkURL?: string
 *   docsURL?: string
 *   renderedAt?: string | Date
 * }} RenderOptions
 */

const DEFAULT_JSON_PROFILE_FILE = "/var/log/jibril.profile.json"
const DEFAULT_APP_BASE_URL = "https://app.garnet.ai"
const DEFAULT_DOCS_URL = "https://github.com/garnet-org/action#readme"
const UTM_SOURCE = "github"
const UTM_MEDIUM = "pr_comment"

const PROFILE_RESULT_SCHEMA = z.unknown().transform(transformProfileResult)

const PROC_TREE_SCHEMA = z
    .looseObject({
        ancestry: z.array(z.string()),
    })
    .transform(transformProcTree)

const ASSERTION_SCHEMA = z.looseObject({
    id: z.string(),
    result: PROFILE_RESULT_SCHEMA,
})

const PEER_SCHEMA = z
    .looseObject({
        result: PROFILE_RESULT_SCHEMA,
        remote_names: z.array(z.string()),
        remote_address: z.string().optional(),
        proc_trees: z.array(PROC_TREE_SCHEMA),
    })
    .transform(transformPeer)

const GITHUB_SCENARIO_SCHEMA = z.object({
    workflow: z.string(),
    repository: z.string(),
    ref: z.string(),
    sha: z.string(),
    actor: z.string(),
    run_id: z.string(),
    job: z.string(),
})

const PROFILE_NETWORK_SCHEMA = z
    .object({
        egress: z
            .object({
                peers: z.array(PEER_SCHEMA).optional(),
            })
            .optional(),
    })
    .optional()

const PROFILE_NETWORK_TELEMETRY_SCHEMA = z
    .object({
        network: z
            .object({
                egress: z
                    .object({
                        total_domains: z.number().optional(),
                        total_connections: z.number().optional(),
                    })
                    .optional(),
            })
            .optional(),
    })
    .optional()

const NORMALIZED_PROFILE_SCHEMA = z.object({
    timestamp: z.string(),
    github: GITHUB_SCENARIO_SCHEMA,
    assertions: z.array(ASSERTION_SCHEMA),
    egress_peers: z.array(PEER_SCHEMA),
    telemetry: z.object({
        total_domains: z.number(),
        total_connections: z.number(),
    }),
    report_link: z.string(),
})

const LEGACY_COMMENT_STATE_SCHEMA = z.object({
    version: z.literal(1),
    latest_run: z.object({
        run_id: z.string(),
        run_attempt: z.number(),
    }),
    profiles: z.array(NORMALIZED_PROFILE_SCHEMA),
})

const COMMENT_STATE_SCHEMA = z.object({
    version: z.literal(2),
    workflow_runs: z.record(
        z.string(),
        z.object({
            run_id: z.string(),
            run_attempt: z.number(),
        }),
    ),
    profiles: z.array(NORMALIZED_PROFILE_SCHEMA),
})

const PROFILE_JSON_SCHEMA = z
    .looseObject({
        timestamp: z.string(),
        scenarios: z.object({
            github: GITHUB_SCENARIO_SCHEMA,
        }),
        assertions: z.array(ASSERTION_SCHEMA),
        network: PROFILE_NETWORK_SCHEMA,
        telemetry: PROFILE_NETWORK_TELEMETRY_SCHEMA,
    })
    .transform(transformProfileJson)

/**
 * @param {unknown} value
 * @returns {ProfileResult}
 */
function transformProfileResult(value) {
    return normalizeResult(value)
}

/**
 * @param {ProcTreeTransformInput} procTree
 * @returns {ProcTree}
 */
function transformProcTree(procTree) {
    const ancestry = Array.isArray(procTree.ancestry) ? procTree.ancestry : []
    return {
        ancestry: ancestry.filter(entry => typeof entry === "string" && entry.length > 0),
    }
}

/**
 * @param {PeerTransformInput} peer
 * @returns {EgressPeer}
 */
function transformPeer(peer) {
    const remoteNames = Array.isArray(peer.remote_names) ? peer.remote_names : []
    const procTrees = Array.isArray(peer.proc_trees) ? peer.proc_trees : []

    return {
        remote_names: remoteNames.filter(name => typeof name === "string" && name.length > 0),
        remote_address: peer.remote_address ?? "",
        proc_trees: /** @type {ProcTree[]} */ (procTrees),
        result: peer.result,
    }
}

/**
 * @param {ProfileJsonTransformInput} profile
 * @returns {NormalizedProfile}
 */
function transformProfileJson(profile) {
    return {
        timestamp: profile.timestamp,
        github: profile.scenarios.github,
        assertions: profile.assertions,
        egress_peers: getProfileNetworkPeers(profile),
        telemetry: getProfileNetworkTelemetry(profile),
        report_link: buildReportLink({
            repository: profile.scenarios.github.repository,
            run_id: profile.scenarios.github.run_id,
            job: profile.scenarios.github.job,
        }),
    }
}

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

/**
 * @param {string} content
 * @returns {NormalizedProfile}
 */
export function parseProfileJson(content) {
    const parsedContent = JSON.parse(content)
    const result = PROFILE_JSON_SCHEMA.safeParse(parsedContent)
    if (result.success) {
        return result.data
    }

    const issues = result.error.issues.map(issue => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "<root>"
        return `${path}: ${issue.message}`
    })
    throw new Error(`Invalid profile JSON: ${issues.join("; ")}`)
}

/**
 * @param {CommentState | null} existingState
 * @param {NormalizedProfile} incomingProfile
 * @param {number} runAttempt
 * @returns {MergeCommentStateResult}
 */
export function mergeCommentState(existingState, incomingProfile, runAttempt) {
    const incomingRunID = incomingProfile.github.run_id
    const incomingRunAttempt = Number.isSafeInteger(runAttempt) ? runAttempt : 1
    const workflowKey = getWorkflowKey(incomingProfile)

    if (incomingRunID === "") {
        throw new Error("profile JSON is missing the GitHub run id")
    }

    if (existingState === null) {
        return {
            kind: "updated",
            state: {
                version: 2,
                workflow_runs: {
                    [workflowKey]: {
                        run_id: incomingRunID,
                        run_attempt: incomingRunAttempt,
                    },
                },
                profiles: [incomingProfile],
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
                version: 2,
                workflow_runs: {
                    ...existingState.workflow_runs,
                    [workflowKey]: {
                        run_id: incomingRunID,
                        run_attempt: incomingRunAttempt,
                    },
                },
                profiles: [
                    ...existingState.profiles.filter(profile => getWorkflowKey(profile) !== workflowKey),
                    incomingProfile,
                ].sort(compareProfiles),
            },
        }
    }

    const profiles = existingState.profiles.filter(profile => getProfileKey(profile) !== getProfileKey(incomingProfile))
    profiles.push(incomingProfile)
    profiles.sort(compareProfiles)

    return {
        kind: "updated",
        state: {
            version: 2,
            workflow_runs: existingState.workflow_runs,
            profiles,
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

    /** @type {Map<string, NormalizedProfile>} */
    const profiles = new Map()

    for (const state of states) {
        for (const profile of state.profiles) {
            const workflowKey = getWorkflowKey(profile)
            const workflowRun = state.workflow_runs[workflowKey] ?? null
            const latestRun = workflowRuns[workflowKey] ?? null
            if (workflowRun === null || latestRun === null || compareRuns(workflowRun, latestRun) !== 0) {
                continue
            }

            profiles.set(getProfileKey(profile), profile)
        }
    }

    return {
        version: 2,
        workflow_runs: workflowRuns,
        profiles: [...profiles.values()].sort(compareProfiles),
    }
}

/**
 * Render the Garnet Runtime Review PR comment body. The runtime-review
 * marker is the FIRST line (canonical sticky marker, A8), followed by the
 * action's own state markers, then the rendered review.
 * @param {CommentState} state
 * @param {RenderOptions} [options]
 * @returns {string}
 */
export function renderCommentBody(state, options = {}) {
    const metadata = encodeCommentState(state)
    const profiles = [...state.profiles].sort(compareProfiles)
    const commitSha = getCommentCommitSha(profiles)
    const review = buildProfileRunReview(profiles, options)
    const reviewBody = renderRunReview(review)

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
 * Build the run review object from normalized profiles (one per job).
 * Shared by the PR comment and the Step Summary so both surfaces render
 * from the same review.
 * @param {NormalizedProfile[]} profiles
 * @param {RenderOptions} [options]
 * @returns {RunReview}
 */
export function buildProfileRunReview(profiles, options = {}) {
    const optionsRecord = /** @type {Record<string, unknown>} */ (options)
    const jobs = profiles.map(profile => profileToJobRecord(profile))
    const sha = getCommentCommitSha(profiles)
    const repository = getCommentRepository(profiles)
    const commitURL = repository !== "" && sha !== "" ? `https://github.com/${repository}/commit/${sha}` : ""
    const permalink = derivePermalink(
        firstNonEmptyString(options.permalinkURL, optionsRecord["permalinkUrl"]),
        jobs,
        resolveAppBaseURL(),
    )

    return buildRunReview({
        repo: repository,
        sha,
        commitURL,
        permalink,
        docsURL: firstNonEmptyString(options.docsURL, optionsRecord["docsUrl"], DEFAULT_DOCS_URL),
        expectedJobs: options.expectedJobs ?? 0,
        renderedAt: options.renderedAt ?? new Date(),
        jobs,
    })
}

/**
 * Collapse one normalized profile into the renderer's job-record shape.
 * @param {NormalizedProfile} profile
 * @returns {JobRecord}
 */
function profileToJobRecord(profile) {
    /** @type {ProfileConnection[]} */
    const connections = []
    for (const peer of profile.egress_peers) {
        const domain = peer.remote_names[0] ?? ""
        const ip = peer.remote_address
        const ancestries =
            peer.proc_trees.length > 0 ? peer.proc_trees.map(tree => tree.ancestry.filter(entry => entry !== "")) : [[]]
        for (const ancestry of ancestries) {
            connections.push({ ancestry, domain, ip })
        }
    }

    return {
        name: profile.github.job,
        workflow: profile.github.workflow,
        sha: profile.github.sha,
        run_id: profile.github.run_id,
        run_url: buildGitHubRunLink(profile.github.repository, profile.github.run_id),
        connections,
    }
}

/**
 * @param {NormalizedProfile[]} profiles
 * @returns {string}
 */
function getCommentRepository(profiles) {
    for (const profile of profiles) {
        if (profile.github.repository !== "") {
            return profile.github.repository
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

        const legacyResult = LEGACY_COMMENT_STATE_SCHEMA.safeParse(parsed)
        return legacyResult.success ? upgradeLegacyCommentState(legacyResult.data) : null
    } catch {
        return null
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
 * @param {NormalizedProfile[]} profiles
 * @returns {string}
 */
function getCommentCommitSha(profiles) {
    for (const profile of profiles) {
        if (profile.github.sha !== "") {
            return profile.github.sha
        }
    }

    return ""
}

/**
 * @param {ReportLinkInput} values
 * @returns {string}
 */
export function buildReportLink(values) {
    const baseURL = resolveAppBaseURL()
    if (values.run_id === "") {
        return utmTrackedURL(baseURL)
    }

    // TODO: Switch back to the full repository/job route once the dashboard
    // supports /dashboard/runs/{org}/{repo}/{runID}/{job}.
    return utmTrackedURL(`${baseURL}/dashboard/runs/${encodeURIComponent(values.run_id)}`)
}

/**
 * @param {string} rawURL
 * @returns {string}
 */
function utmTrackedURL(rawURL) {
    try {
        const url = new URL(rawURL)
        url.searchParams.set("utm_source", UTM_SOURCE)
        url.searchParams.set("utm_medium", UTM_MEDIUM)
        return url.toString()
    } catch {
        return rawURL
    }
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
function resolveAppBaseURL() {
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
 * @param {LegacyCommentState} state
 * @returns {CommentState}
 */
function upgradeLegacyCommentState(state) {
    return {
        version: 2,
        workflow_runs: state.profiles.reduce((accumulator, profile) => {
            accumulator[getWorkflowKey(profile)] = state.latest_run
            return accumulator
        }, /** @type {Record<string, WorkflowRun>} */ ({})),
        profiles: [...state.profiles].sort(compareProfiles),
    }
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function getWorkflowKey(profile) {
    return getDisplayValue(profile.github.workflow, "unknown-workflow")
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function getProfileKey(profile) {
    return `${getWorkflowKey(profile)}\u0000${getDisplayValue(profile.github.job, "unknown-job")}`
}

/**
 * @param {NormalizedProfile} left
 * @param {NormalizedProfile} right
 * @returns {number}
 */
function compareProfiles(left, right) {
    const workflowCompare = getWorkflowKey(left).localeCompare(getWorkflowKey(right))
    if (workflowCompare !== 0) {
        return workflowCompare
    }

    return left.github.job.localeCompare(right.github.job)
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
 * @param {unknown} value
 * @returns {ProfileResult}
 */
function normalizeResult(value) {
    const normalized = getString(value).toLowerCase()
    if (normalized === "pass" || normalized === "attention" || normalized === "fail") {
        return normalized
    }
    return "unknown"
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function getNumber(value) {
    return typeof value === "number" ? value : 0
}

/**
 * @param {unknown} profile
 * @returns {EgressPeer[]}
 */
function getProfileNetworkPeers(profile) {
    const root = getOptionalRecord(profile)
    const network = getOptionalRecord(root?.network)
    const egress = getOptionalRecord(network?.egress)
    return Array.isArray(egress?.peers) ? egress.peers : []
}

/**
 * @param {unknown} profile
 * @returns {NetworkTelemetry}
 */
function getProfileNetworkTelemetry(profile) {
    const root = getOptionalRecord(profile)
    const telemetry = getOptionalRecord(root?.telemetry)
    const network = getOptionalRecord(telemetry?.network)
    const egress = getOptionalRecord(network?.egress)

    return {
        total_domains: getNumber(egress?.total_domains),
        total_connections: getNumber(egress?.total_connections),
    }
}

/**
 * @param {...unknown} values
 * @returns {string}
 */
function firstNonEmptyString(...values) {
    for (const value of values) {
        if (typeof value === "string" && value !== "") {
            return value
        }
    }
    return ""
}

/**
 * @param {string} value
 * @param {string} fallback
 * @returns {string}
 */
function getDisplayValue(value, fallback) {
    return value !== "" ? value : fallback
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function getString(value) {
    return typeof value === "string" ? value : ""
}

