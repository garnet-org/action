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
 * @typedef {"run_cancelled" | "crashed" | "flush_timeout" | "stopped_cleanly"} AgentStopReason
 */

/**
 * @typedef {"present" | "missing" | "empty" | "invalid"} AgentProfileState
 */

/**
 * @typedef {"completed" | "timed_out"} AgentStopOutcome
 */

/**
 * @typedef {"github_api"} JobStatusSource
 */

/**
 * @typedef {object} AgentStoppedJibrilFields
 * @property {string=} activeState
 * @property {string=} result
 * @property {number=} execMainStatus
 * @property {AgentStopOutcome=} stopOutcome
 * @property {boolean=} forceStopped
 */

/**
 * @typedef {object} AgentStoppedRequest
 * @property {AgentStopReason} reason
 * @property {AgentProfileState} profileState
 * @property {string=} detail
 * @property {string} runID
 * @property {string=} runAttempt
 * @property {string=} job
 * @property {"cancelled" | "failure"=} jobStatus
 * @property {JobStatusSource=} jobStatusSource
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

export const AGENT_STOP_REASON_SCHEMA = z.enum(["run_cancelled", "crashed", "flush_timeout", "stopped_cleanly"])

export const AGENT_STOPPED_REQUEST_SCHEMA = z.object({
    reason: AGENT_STOP_REASON_SCHEMA,
    profileState: z.enum(["present", "missing", "empty", "invalid"]),
    detail: z.string().optional(),
    runID: z.string().min(1),
    runAttempt: z.string().min(1).optional(),
    job: z.string().min(1).optional(),
    jobStatus: z.enum(["cancelled", "failure"]).optional(),
    jobStatusSource: z.enum(["github_api"]).optional(),
    jibril: z
        .object({
            activeState: z.string().optional(),
            result: z.string().optional(),
            execMainStatus: z.number().int().optional(),
            stopOutcome: z.enum(["completed", "timed_out"]).optional(),
            forceStopped: z.boolean().optional(),
        })
        .optional(),
})
