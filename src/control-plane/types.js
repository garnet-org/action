import { z } from "zod"

/**
 * @typedef {{
 *   job: string
 *   run_id: string
 *   workflow: string
 *   repository: string
 *   repository_id: string
 *   [key: string]: unknown
 * }} AgentGithubContext
 */

/**
 * @typedef {{
 *   os: string
 *   arch: string
 *   hostname: string
 *   version: string
 *   ip: string
 *   machine_id: string
 *   kind: "github" | "kubernetes"
 *   github_context?: AgentGithubContext
 *   labels?: Record<string, string>
 * }} CreateAgentRequest
 */

/**
 * @typedef {{
 *   id: string
 *   agent_token: string
 * }} AgentCreatedResponse
 */

/**
 * @typedef {{
 *   repository_id?: string
 *   workflow_name?: string
 * }} MergedNetPoliciesRequest
 */

/**
 * @typedef {{
 *   idToken: string
 * }} ExchangeOIDCRequest
 */

/**
 * @typedef {"public" | "private" | "internal"} RepositoryVisibility
 */

/**
 * @typedef {object} GitHubRunClaims
 * @property {string} repositoryID
 * @property {string=} repository
 * @property {string} repositoryOwnerID
 * @property {string=} repositoryOwner
 * @property {RepositoryVisibility} repositoryVisibility
 * @property {string} runID
 * @property {string} runAttempt
 * @property {string=} runNumber
 * @property {string=} sha
 * @property {string=} ref
 * @property {string=} actorID
 * @property {string=} eventName
 * @property {string=} workflowRef
 * @property {string=} jobWorkflowRef
 * @property {string=} runnerEnvironment
 */

/**
 * @typedef {object} ExchangeOIDCResponse
 * @property {string} workflowToken
 * @property {string} expiresAt
 * @property {GitHubRunClaims} github
 */

export const AGENT_GITHUB_CONTEXT_SCHEMA = z
    .object({
        job: z.string().min(1),
        run_id: z.string().min(1),
        workflow: z.string().min(1),
        repository: z.string().min(1),
        repository_id: z.string().min(1),
        action: z.string().min(1).optional(),
        actor: z.string().min(1).optional(),
        actor_id: z.string().min(1).optional(),
        event_name: z.string().min(1).optional(),
        ref: z.string().min(1).optional(),
        ref_name: z.string().min(1).optional(),
        ref_protected: z.boolean().optional(),
        ref_type: z.string().min(1).optional(),
        repository_owner: z.string().min(1).optional(),
        repository_owner_id: z.string().min(1).optional(),
        workflow_ref: z.string().min(1).optional(),
    })
    .passthrough()

export const CREATE_AGENT_REQUEST_SCHEMA = z.object({
    os: z.string().min(1),
    arch: z.string().min(1),
    hostname: z.string().min(1),
    version: z.string().min(1),
    ip: z.ipv4(),
    machine_id: z.string().min(1),
    kind: z.enum(["github", "kubernetes"]),
    github_context: AGENT_GITHUB_CONTEXT_SCHEMA.optional(),
    labels: z.record(z.string(), z.string()).optional(),
})

export const AGENT_CREATED_RESPONSE_SCHEMA = z.object({
    id: z.string().min(1),
    agent_token: z.string().min(1),
})

export const MERGED_NET_POLICIES_REQUEST_SCHEMA = z.object({
    repository_id: z.string().min(1).optional(),
    workflow_name: z.string().min(1).optional(),
})

export const EXCHANGE_OIDC_REQUEST_SCHEMA = z.object({
    idToken: z.string().min(1),
})

export const REPOSITORY_VISIBILITY_SCHEMA = z.enum(["public", "private", "internal"])

export const GITHUB_RUN_CLAIMS_SCHEMA = z.object({
    repositoryID: z.string().min(1),
    repository: z.string().min(1).optional(),
    repositoryOwnerID: z.string().min(1),
    repositoryOwner: z.string().min(1).optional(),
    repositoryVisibility: REPOSITORY_VISIBILITY_SCHEMA,
    runID: z.string().min(1),
    runAttempt: z.string().min(1),
    runNumber: z.string().min(1).optional(),
    sha: z.string().min(1).optional(),
    ref: z.string().min(1).optional(),
    actorID: z.string().min(1).optional(),
    eventName: z.string().min(1).optional(),
    workflowRef: z.string().min(1).optional(),
    jobWorkflowRef: z.string().min(1).optional(),
    runnerEnvironment: z.string().min(1).optional(),
})

export const EXCHANGE_OIDC_RESPONSE_SCHEMA = z.object({
    workflowToken: z.string().min(1),
    expiresAt: z.iso.datetime(),
    github: GITHUB_RUN_CLAIMS_SCHEMA,
})

export const API_ERROR_SCHEMA = z.object({
    error: z.string().min(1),
})

/**
 * @typedef {object} ProfileEnvelope
 * @property {string} id
 * @property {string} runID
 * @property {string} job
 */

/**
 * @typedef {object} ProfileEnvelopePage
 * @property {ProfileEnvelope[]} items
 */

/**
 * @typedef {"run_cancelled" | "crashed" | "flush_timeout" | "stopped_cleanly" | "start_failed"} AgentStopReason
 */

/**
 * @typedef {"present" | "missing" | "empty" | "invalid"} AgentProfileState
 */

/**
 * @typedef {"completed" | "timed_out"} AgentStopOutcome
 */

/**
 * `sensorStatus`, `ebpfErrors`, `githubSteps` and `kernel` come from jibril's
 * own readiness files (v2.17.0 and later) and explain a missing or partial
 * capture. They carry jibril's shape as parsed, where null means the sensor
 * reported no value; `ebpfErrors` is absent when the loader never reported
 * counters at all, which is not the same as reporting zero.
 * TODO(control-plane): /agent/stopped does not persist these four fields yet.
 * @typedef {object} AgentStoppedJibrilFields
 * @property {string=} activeState
 * @property {string=} result
 * @property {number=} execMainStatus
 * @property {AgentStopOutcome=} stopOutcome
 * @property {boolean=} forceStopped
 * @property {import("../jibril-status.js").JibrilState | null=} sensorStatus
 * @property {import("../jibril-status.js").JibrilEbpfErrors=} ebpfErrors
 * @property {import("../jibril-status.js").JibrilSteps=} githubSteps
 * @property {import("../jibril-status.js").JibrilKernel | null=} kernel
 */

/**
 * @typedef {object} AgentStoppedRequest
 * @property {AgentStopReason} reason
 * @property {AgentProfileState} profileState
 * @property {string=} detail
 * @property {"cancelled" | "failure"=} jobStatus
 * @property {AgentStoppedJibrilFields=} jibril
 */

export const PROFILE_ENVELOPE_SCHEMA = z
    .object({
        id: z.string().min(1),
        runID: z.string().default(""),
        job: z.string().default(""),
    })
    .passthrough()

export const PROFILE_ENVELOPE_PAGE_SCHEMA = z
    .object({
        items: z.array(PROFILE_ENVELOPE_SCHEMA).default([]),
    })
    .passthrough()

export const AGENT_STOP_REASON_SCHEMA = z.enum([
    "run_cancelled",
    "crashed",
    "flush_timeout",
    "stopped_cleanly",
    "start_failed",
])

// The sensor blocks mirror jibril's status files, validated here so a shape
// this action does not expect never reaches the control plane.
const SENSOR_STATUS_SCHEMA = z.enum(["disabled", "ok", "degraded"]).nullable()
const COUNT_SCHEMA = z.number().int().nonnegative()

const EBPF_ERRORS_SCHEMA = z.object({
    load: COUNT_SCHEMA,
    attach: COUNT_SCHEMA,
    link: COUNT_SCHEMA,
    attachFailures: z.array(z.object({ program: z.string(), error: z.string() })),
})

const GITHUB_STEPS_SCHEMA = z.object({
    status: SENSOR_STATUS_SCHEMA,
    source: z.enum(["none", "api", "local"]).nullable(),
    count: COUNT_SCHEMA,
    errors: z.array(z.string()),
})

const KERNEL_SCHEMA = z.object({
    release: z.string(),
    bpf: z.object({
        btf: z.boolean(),
        lsm: z.boolean(),
        tracefs: z.boolean(),
        cgroup2: z.boolean(),
        lockdown: z.enum(["none", "integrity", "confidentiality", "unknown"]).nullable(),
    }),
})

export const AGENT_STOPPED_REQUEST_SCHEMA = z.object({
    reason: AGENT_STOP_REASON_SCHEMA,
    profileState: z.enum(["present", "missing", "empty", "invalid"]),
    detail: z.string().optional(),
    jobStatus: z.enum(["cancelled", "failure"]).optional(),
    jibril: z
        .object({
            activeState: z.string().optional(),
            result: z.string().optional(),
            execMainStatus: z.number().int().optional(),
            stopOutcome: z.enum(["completed", "timed_out"]).optional(),
            forceStopped: z.boolean().optional(),
            sensorStatus: SENSOR_STATUS_SCHEMA.optional(),
            ebpfErrors: EBPF_ERRORS_SCHEMA.optional(),
            githubSteps: GITHUB_STEPS_SCHEMA.optional(),
            kernel: KERNEL_SCHEMA.nullable().optional(),
        })
        .optional(),
})
