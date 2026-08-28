import { z } from "zod"
import {
    buildRunReview,
    edgeCounts,
    renderRunReview,
    summarizeProfile,
    pullRequestURL,
    isSafeRepository,
    COMMENT_MARKER,
    RUNTIME_REVIEW_MARKER,
    SIZE_BUDGET,
} from "./runtime-review.js"

/** @typedef {import("./runtime-review.js").RunReview} RunReview */
/** @typedef {import("./runtime-review.js").JobSummary} JobSummary */
/** @typedef {import("./runtime-review.js").ReviewEdge} ReviewEdge */

export const ACTION_COMMENT_MARKER = "garnet-action-pr-comment:v1"
export const COMMIT_MARKER_PREFIX = "garnet-pr-commit:"
export const LEGACY_COMMENT_STATE_MARKER = "garnet-runtime-visibility"

const COMMENT_STATE_MARKER_PREFIX = "garnet-action-comment-state:"

// GitHub rejects issue comments above this many characters; the final body
// (rendered review plus the hidden state marker) must stay under it.
const COMMENT_HARD_LIMIT = 65536

// Comment state is attacker-reachable input: anyone who can comment on a PR
// can write a marker with an arbitrary payload. Decoding is bounded so a
// crafted payload cannot be used to inflate work or memory before the
// schema rejects it.
const MAX_ENCODED_STATE_LENGTH = COMMENT_HARD_LIMIT
const MAX_STATE_PROFILES = 128
const MAX_STATE_WORKFLOW_RUNS = 128
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/

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
 * One profile as carried inside the sticky-comment state: the GitHub
 * scenario key fields used by the merge machinery plus the renderer's full
 * job summary (v6.6.1 shape — edges, assertions, telemetry, metadata).
 * @typedef {{
 *   timestamp: string
 *   github: GitHubScenario
 *   job: JobSummary
 * }} NormalizedProfile
 */

/**
 * @typedef {{
 *   run_id: string
 *   run_attempt: number
 * }} WorkflowRun
 */

/**
 * @typedef {{
 *   version: 3
 *   workflow_runs: Record<string, WorkflowRun>
 *   profiles: NormalizedProfile[]
 * }} CommentState
 */

/**
 * Rendering knobs threaded from the action's inputs (all optional, additive).
 * `firstRun` drives the explainer's open state: true through the PR's
 * first-commit lifecycle, false on every update after.
 * @typedef {{
 *   renderedAt?: string | Date
 *   firstRun?: boolean
 * }} RenderOptions
 */

const DEFAULT_JSON_PROFILE_FILE = "/var/log/jibril.profile.json"
const DEFAULT_APP_BASE_URL = "https://app.garnet.ai"
const UTM_SOURCE = "github"
const UTM_MEDIUM = "pr_comment"

const GITHUB_SCENARIO_SCHEMA = z.object({
    workflow: z.string(),
    repository: z.string(),
    ref: z.string(),
    sha: z.string(),
    actor: z.string(),
    run_id: z.string(),
    job: z.string(),
})

const REVIEW_EDGE_SCHEMA = z.object({
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
    // Kept for the ran-from provenance note only — the full path never
    // renders; historical states without it default to empty.
    executable: z.string().default(""),
})

const ASSERTION_EVIDENCE_SCHEMA = z.object({
    timestamp: z.string(),
    event: z.string(),
    remote_peer: z.string(),
    protocol: z.string(),
    ports: z.string(),
    result: z.string(),
})

const JOB_ASSERTION_SCHEMA = z.object({
    class_id: z.string(),
    id: z.string(),
    description: z.string(),
    result: z.string(),
    evidence: z.array(ASSERTION_EVIDENCE_SCHEMA),
})

const JOB_SUMMARY_SCHEMA = z.object({
    name: z.string(),
    workflow: z.string(),
    repository: z.string(),
    sha: z.string(),
    run_id: z.string(),
    run_url: z.string(),
    profile_id: z.string(),
    uuid: z.string(),
    timestamp: z.string(),
    ref: z.string(),
    pr_url: z.string().default(""),
    actor: z.string(),
    job_index: z.string(),
    flow_count: z.number(),
    telemetry: z.object({
        total_domains: z.number().nullable(),
        total_connections: z.number().nullable(),
    }),
    assertions: z.array(JOB_ASSERTION_SCHEMA),
    edges: z.array(REVIEW_EDGE_SCHEMA),
    counts: z.object({
        associations: z.number(),
        processes: z.number(),
        destinations: z.number(),
        primary_names: z.number(),
        domains: z.number(),
        flows: z.number(),
    }),
})

const NORMALIZED_PROFILE_SCHEMA = z.object({
    timestamp: z.string(),
    github: GITHUB_SCENARIO_SCHEMA,
    job: JOB_SUMMARY_SCHEMA,
})

const COMMENT_STATE_SCHEMA = z.object({
    version: z.literal(3),
    workflow_runs: z.record(
        z.string(),
        z.object({
            run_id: z.string(),
            run_attempt: z.number(),
        }),
    ),
    profiles: z.array(NORMALIZED_PROFILE_SCHEMA),
})

// Pre-v3 comment states (versions 1 and 2) carried a reduced profile shape
// (egress peers without ports/protocol/detections/steps). They are upgraded
// on read so an in-flight PR keeps its sticky comment across the renderer
// upgrade; missing fields default to empty.
const LEGACY_PROC_TREE_SCHEMA = z.looseObject({
    ancestry: z.array(z.string()),
})

const LEGACY_PEER_SCHEMA = z.looseObject({
    remote_names: z.array(z.string()),
    remote_address: z.string().optional(),
    proc_trees: z.array(LEGACY_PROC_TREE_SCHEMA),
    result: z.unknown(),
})

const LEGACY_PROFILE_SCHEMA = z.looseObject({
    timestamp: z.string(),
    github: GITHUB_SCENARIO_SCHEMA,
    egress_peers: z.array(LEGACY_PEER_SCHEMA),
    telemetry: z.object({
        total_domains: z.number(),
        total_connections: z.number(),
    }),
})

const LEGACY_V1_STATE_SCHEMA = z.object({
    version: z.literal(1),
    latest_run: z.object({
        run_id: z.string(),
        run_attempt: z.number(),
    }),
    profiles: z.array(LEGACY_PROFILE_SCHEMA),
})

const LEGACY_V2_STATE_SCHEMA = z.object({
    version: z.literal(2),
    workflow_runs: z.record(
        z.string(),
        z.object({
            run_id: z.string(),
            run_attempt: z.number(),
        }),
    ),
    profiles: z.array(LEGACY_PROFILE_SCHEMA),
})

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
    const job = summarizeProfile(parsedContent)
    if (job === null) {
        throw new Error("Invalid profile JSON: not a profile object")
    }

    return {
        timestamp: job.timestamp,
        github: {
            workflow: job.workflow,
            repository: job.repository,
            ref: job.ref,
            sha: job.sha,
            actor: job.actor,
            run_id: job.run_id,
            job: job.name,
        },
        job,
    }
}

/**
 * @param {CommentState | null} existingState
 * @param {NormalizedProfile} incomingProfile
 * @param {number} runAttempt
 * @returns {{ kind: "stale" } | { kind: "updated", state: CommentState }}
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
                version: 3,
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
                version: 3,
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
            version: 3,
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
        version: 3,
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
    const metadata = encodeCommentStateWithinBudget(state)
    const profiles = [...state.profiles].sort(compareProfiles)
    const commitSha = getCommentCommitSha(profiles)
    const review = buildProfileRunReview(profiles)
    const markerOverhead = Buffer.byteLength(
        [`<!-- ${ACTION_COMMENT_MARKER} -->`, `<!-- ${COMMIT_MARKER_PREFIX}${commitSha} -->`, `<!-- ${COMMENT_STATE_MARKER_PREFIX}${metadata} -->`, ""].join("\n"),
        "utf8",
    )
    const reviewBody = renderRunReview(review, {
        explainerOpen: options.firstRun === true,
        budget: Math.min(SIZE_BUDGET, COMMENT_HARD_LIMIT - markerOverhead),
    })

    // v6.2 marker block: canonical marker, self marker, then the commit
    // marker `<!-- garnet:commit {full sha} -->` (all emitted by the
    // renderer), followed by the action's own state markers.
    const commitMarker = commitSha !== "" ? `<!-- garnet:commit ${commitSha} -->\n` : ""
    const markerPrefix = `${RUNTIME_REVIEW_MARKER}\n${COMMENT_MARKER}\n${commitMarker}`
    if (!reviewBody.startsWith(markerPrefix)) {
        throw new Error("rendered review body is missing the runtime-review markers")
    }

    return [
        RUNTIME_REVIEW_MARKER,
        COMMENT_MARKER,
        ...(commitSha !== "" ? [`<!-- garnet:commit ${commitSha} -->`] : []),
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
 * @returns {RunReview}
 */
export function buildProfileRunReview(profiles) {
    const sha = getCommentCommitSha(profiles)
    const repository = getCommentRepository(profiles)
    const commitUrl =
        isSafeRepository(repository) && /^[0-9a-fA-F]{7,40}$/.test(sha)
            ? `https://github.com/${repository}/commit/${sha}`
            : ""
    const appUrl = resolveAppBaseURL()

    return buildRunReview({
        repo: repository,
        sha,
        commitUrl,
        appUrl,
        jobs: profiles.map(profile => profile.job),
    })
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
 * Decodes the sticky-comment state carried by an existing comment body.
 * The body is untrusted: any decoding, schema, or size anomaly yields null
 * so the caller ignores the state and publishes fresh.
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

    const json = decodeStatePayload(encoded)
    if (json === null) {
        return null
    }

    /** @type {unknown} */
    let parsed
    try {
        parsed = JSON.parse(json)
    } catch {
        return null
    }

    const state = parseStateShape(parsed)
    if (state === null || !isWithinStateLimits(state)) {
        return null
    }

    return state
}

/**
 * @param {unknown} parsed
 * @returns {CommentState | null}
 */
function parseStateShape(parsed) {
    const result = COMMENT_STATE_SCHEMA.safeParse(parsed)
    if (result.success) {
        return result.data
    }

    const legacyV2 = LEGACY_V2_STATE_SCHEMA.safeParse(parsed)
    if (legacyV2.success) {
        return {
            version: 3,
            workflow_runs: legacyV2.data.workflow_runs,
            profiles: legacyV2.data.profiles.map(upgradeLegacyProfile).sort(compareProfiles),
        }
    }

    const legacyV1 = LEGACY_V1_STATE_SCHEMA.safeParse(parsed)
    if (legacyV1.success) {
        const profiles = legacyV1.data.profiles.map(upgradeLegacyProfile).sort(compareProfiles)
        /** @type {Record<string, WorkflowRun>} */
        const workflowRuns = {}
        for (const profile of profiles) {
            workflowRuns[getWorkflowKey(profile)] = legacyV1.data.latest_run
        }
        return { version: 3, workflow_runs: workflowRuns, profiles }
    }

    return null
}

/**
 * Base64url-decodes a state payload, rejecting oversized payloads and any
 * text that is not canonical base64url (Node's decoder silently drops
 * characters outside the alphabet, so the encoding is checked first).
 * @param {string} encoded
 * @returns {string | null}
 */
function decodeStatePayload(encoded) {
    if (encoded.length === 0 || encoded.length > MAX_ENCODED_STATE_LENGTH) {
        return null
    }

    if (!BASE64URL_PATTERN.test(encoded)) {
        return null
    }

    const decoded = Buffer.from(encoded, "base64url")
    if (decoded.toString("base64url") !== encoded) {
        return null
    }

    return decoded.toString("utf8")
}

/**
 * @param {CommentState} state
 * @returns {boolean}
 */
function isWithinStateLimits(state) {
    if (state.profiles.length > MAX_STATE_PROFILES) {
        return false
    }

    return Object.keys(state.workflow_runs).length <= MAX_STATE_WORKFLOW_RUNS
}

/**
 * A pre-v3 state profile carried egress peers without ports, protocol,
 * detections, PIDs, or step attribution; the upgrade fills those with
 * empty defaults so the review still renders every recorded chain.
 * @param {z.infer<typeof LEGACY_PROFILE_SCHEMA>} profile
 * @returns {NormalizedProfile}
 */
function upgradeLegacyProfile(profile) {
    /** @type {ReviewEdge[]} */
    const edges = []
    profile.egress_peers.forEach((peer, peerIndex) => {
        const trees = peer.proc_trees.length > 0 ? peer.proc_trees : [{ ancestry: [] }]
        trees.forEach((tree, treeIndex) => {
            const ancestry = tree.ancestry.filter(entry => entry !== "")
            edges.push({
                flow_id: peerIndex,
                tree_index: treeIndex,
                remote_address: peer.remote_address ?? "",
                remote_names: peer.remote_names.filter(name => name !== ""),
                remote_ports: [],
                protocol: "",
                result: typeof peer.result === "string" ? peer.result : "",
                detections: [],
                lineage_recorded: ancestry.length > 0,
                pid: "",
                process: ancestry[ancestry.length - 1] ?? "",
                ancestry,
                github_step: "",
                executable: "",
            })
        })
    })

    /** @type {JobSummary} */
    const job = {
        name: profile.github.job,
        workflow: profile.github.workflow,
        repository: profile.github.repository,
        sha: profile.github.sha,
        run_id: profile.github.run_id,
        run_url: buildGitHubRunLink(profile.github.repository, profile.github.run_id),
        profile_id: "",
        uuid: "",
        timestamp: profile.timestamp,
        ref: profile.github.ref,
        pr_url: pullRequestURL(profile.github),
        actor: profile.github.actor,
        job_index: "",
        flow_count: profile.egress_peers.length,
        telemetry: {
            total_domains: profile.telemetry.total_domains,
            total_connections: profile.telemetry.total_connections,
        },
        assertions: [],
        edges,
        counts: edgeCounts(edges, profile.egress_peers.length),
    }

    return { timestamp: profile.timestamp, github: profile.github, job }
}

/**
 * @param {CommentState} state
 * @returns {string}
 */
function encodeCommentState(state) {
    return Buffer.from(JSON.stringify(state), "utf8").toString("base64url")
}

// The encoded state rides inside the comment, so it shares the comment's
// hard limit with the rendered review. When the full state cannot leave the
// review at least the contract's minimal fallback, assertion evidence rows
// are dropped from the carried state (assertion results are kept; the
// Execution Profile remains the untruncated record).
const STATE_BYTE_BUDGET = COMMENT_HARD_LIMIT - 8192

/**
 * @param {CommentState} state
 * @returns {string}
 */
function encodeCommentStateWithinBudget(state) {
    const encoded = encodeCommentState(state)
    if (encoded.length <= STATE_BYTE_BUDGET) {
        return encoded
    }

    /** @type {CommentState} */
    const slimmed = {
        version: 3,
        workflow_runs: state.workflow_runs,
        profiles: state.profiles.map(profile => ({
            ...profile,
            job: {
                ...profile.job,
                assertions: profile.job.assertions.map(assertion => ({ ...assertion, evidence: [] })),
            },
        })),
    }

    return encodeCommentState(slimmed)
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
 * @typedef {Object} ReportLinkInput
 * @property {string} repository
 * @property {string} run_id
 * @property {string} job
 */

/**
 * @param {ReportLinkInput} values
 * @returns {string}
 */
export function buildReportLink(values) {
    const baseURL = resolveAppBaseURL()
    if (values.run_id === "") {
        return utmTrackedURL(baseURL)
    }

    // The tokenless PUBLIC report route (v6.1 §1.1) — never the authed
    // dashboard, which would wall cold PR traffic behind a login. Run-level:
    // no `?job=` selector (per-job `?job=` permalinks are the control-plane
    // GitHub App comment's job — ENG-1355).
    return utmTrackedURL(`${baseURL}/public/runs/${encodeURIComponent(values.run_id)}`)
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
 * The Garnet app base URL for permalinks, mapped from the configured API
 * host (dev-api → dev-app, …).
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
 * @typedef {Object} RunOrderKey
 * @property {string} run_id
 * @property {number} run_attempt
 */

/**
 * @param {RunOrderKey} left
 * @param {RunOrderKey} right
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

