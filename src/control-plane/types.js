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

export const API_ERROR_SCHEMA = z.object({
    error: z.string().min(1),
})
