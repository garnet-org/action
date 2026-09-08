import {
    AGENT_CREATED_RESPONSE_SCHEMA,
    AGENT_STOPPED_REQUEST_SCHEMA,
    API_ERROR_SCHEMA,
    CREATE_AGENT_REQUEST_SCHEMA,
    EXCHANGE_OIDC_REQUEST_SCHEMA,
    EXCHANGE_OIDC_RESPONSE_SCHEMA,
    MERGED_NET_POLICIES_REQUEST_SCHEMA,
    PROFILE_ENVELOPE_PAGE_SCHEMA,
} from "./types.js"

/**
 * @typedef {import("./types.js").CreateAgentRequest} CreateAgentRequest
 * @typedef {import("./types.js").AgentCreatedResponse} AgentCreatedResponse
 * @typedef {import("./types.js").MergedNetPoliciesRequest} MergedNetPoliciesRequest
 * @typedef {import("./types.js").ExchangeOIDCResponse} ExchangeOIDCResponse
 * @typedef {import("./types.js").ProfileEnvelopePage} ProfileEnvelopePage
 * @typedef {import("./types.js").AgentStoppedRequest} AgentStoppedRequest
 */

/**
 * @typedef {{
 *   runID?: string
 *   runAttempt?: string
 * }} AgentProfilesQuery
 */

/**
 * @typedef {{
 *   baseURL: string
 *   projectToken?: string
 *   workflowToken?: string
 *   agentToken?: string
 *   userAgent?: string
 * }} ControlPlaneClientOptions
 */

/**
 * @typedef {{
 *   method: "GET" | "POST"
 *   path: string
 *   query?: URLSearchParams
 *   body?: unknown
 *   accept?: string
 *   skipAuthHeader?: boolean
 *   timeoutMs?: number
 * }} RequestOptions
 */

/**
 * @typedef {{
 *   status: number
 *   responseText: string
 * }} RequestTextResult
 */

export class ControlPlaneClient {
    /**
     * @param {ControlPlaneClientOptions} options
     */
    constructor(options) {
        if (typeof options.baseURL !== "string" || options.baseURL.trim() === "") {
            throw new Error("ControlPlaneClient: 'baseURL' is required")
        }

        let parsedBaseURL
        try {
            parsedBaseURL = new URL(options.baseURL)
        } catch {
            throw new Error("ControlPlaneClient: 'baseURL' must be a valid absolute URL")
        }

        if (parsedBaseURL.protocol !== "http:" && parsedBaseURL.protocol !== "https:") {
            throw new Error("ControlPlaneClient: 'baseURL' protocol must be http or https")
        }

        if (parsedBaseURL.pathname !== "/") {
            throw new Error("ControlPlaneClient: 'baseURL' must not include a path, query, or fragment")
        }

        if (parsedBaseURL.search !== "") {
            throw new Error("ControlPlaneClient: 'baseURL' must not include a query")
        }

        if (parsedBaseURL.hash !== "") {
            throw new Error("ControlPlaneClient: 'baseURL' must not include a fragment")
        }

        if (options.projectToken !== undefined && typeof options.projectToken !== "string") {
            throw new Error("ControlPlaneClient: 'projectToken' must be a string when provided")
        }

        if (options.workflowToken !== undefined && typeof options.workflowToken !== "string") {
            throw new Error("ControlPlaneClient: 'workflowToken' must be a string when provided")
        }

        if (options.agentToken !== undefined && typeof options.agentToken !== "string") {
            throw new Error("ControlPlaneClient: 'agentToken' must be a string when provided")
        }

        this.baseURL = parsedBaseURL.toString().replace(/\/+$/, "")
        this.projectToken = options.projectToken?.trim() ?? ""
        this.workflowToken = options.workflowToken?.trim() ?? ""
        this.agentToken = options.agentToken?.trim() ?? ""
        this.userAgent = options.userAgent ?? "garnet-action"
    }

    /**
     * @param {CreateAgentRequest} input
     * @returns {Promise<AgentCreatedResponse>}
     */
    async createAgent(input) {
        const payload = CREATE_AGENT_REQUEST_SCHEMA.parse(input)
        const responseJson = await this.requestJson({
            method: "POST",
            path: "/api/v1/agents",
            body: payload,
        })

        return AGENT_CREATED_RESPONSE_SCHEMA.parse(responseJson)
    }

    /**
     * @param {string} idToken
     * @returns {Promise<ExchangeOIDCResponse>}
     */
    async exchangeGitHubOIDCForWorkflowToken(idToken) {
        const payload = EXCHANGE_OIDC_REQUEST_SCHEMA.parse({
            idToken,
        })
        const responseJson = await this.requestJson({
            method: "POST",
            path: "/api/v1/github/oidc/exchange",
            body: payload,
            skipAuthHeader: true,
        })

        return EXCHANGE_OIDC_RESPONSE_SCHEMA.parse(responseJson)
    }

    /**
     * Lists the profile envelopes recorded for an agent, newest metadata
     * shape passed through as-is; only the envelope identity fields are
     * validated.
     * @param {string} agentID
     * @param {AgentProfilesQuery} [queryInput]
     * @returns {Promise<ProfileEnvelopePage>}
     */
    async agentProfiles(agentID, queryInput = {}) {
        if (typeof agentID !== "string" || agentID.trim() === "") {
            throw new Error("ControlPlaneClient: 'agentID' is required")
        }

        const query = new URLSearchParams()
        if (queryInput.runID !== undefined && queryInput.runID !== "") {
            query.set("run_id", queryInput.runID)
        }
        if (queryInput.runAttempt !== undefined && queryInput.runAttempt !== "") {
            query.set("run_attempt", queryInput.runAttempt)
        }

        const responseJson = await this.requestJson({
            method: "GET",
            path: `/api/v1/agents/${encodeURIComponent(agentID)}/profiles`,
            query,
        })

        return PROFILE_ENVELOPE_PAGE_SCHEMA.parse(responseJson)
    }

    /**
     * Signals that this run's sensor stopped, with the reason and whether a usable
     * Run Profile was produced, so the control plane can resolve pending state.
     * Authenticated as the agent itself.
     * @param {AgentStoppedRequest} input
     * @returns {Promise<void>}
     */
    async reportAgentStopped(input) {
        const payload = AGENT_STOPPED_REQUEST_SCHEMA.parse(input)
        // Keep the post step fast: one bounded best-effort request only.
        await this.requestText({
            method: "POST",
            path: "/api/v1/agent/stopped",
            body: payload,
            timeoutMs: 10_000,
        })
    }

    /**
     * @param {MergedNetPoliciesRequest} input
     * @returns {Promise<string>}
     */
    async mergedNetPoliciesAsYAML(input) {
        const params = MERGED_NET_POLICIES_REQUEST_SCHEMA.parse(input)
        const query = new URLSearchParams()
        query.set("format", "yaml")

        if (params.repository_id !== undefined) {
            query.set("repository_id", params.repository_id)
        }

        if (params.workflow_name !== undefined) {
            query.set("workflow_name", params.workflow_name)
        }

        const { responseText, status } = await this.requestText({
            method: "GET",
            path: "/api/v1/network_policies/merged",
            query,
            accept: "application/x-yaml, text/yaml, text/plain, */*",
        })

        if (responseText.trim() === "") {
            throw new Error(
                `Control plane request failed: GET /api/v1/network_policies/merged (HTTP ${status}: empty response body)`,
            )
        }

        return responseText
    }

    /**
     * @param {RequestOptions} options
     * @returns {Promise<unknown>}
     */
    async requestJson(options) {
        const { responseText, status } = await this.requestText({
            ...options,
            accept: "application/json",
        })

        if (responseText.trim() === "") {
            return {}
        }

        try {
            return JSON.parse(responseText)
        } catch {
            throw new Error(
                `Control plane request failed: ${options.method} ${options.path} (HTTP ${status}: expected JSON but received non-JSON response)`,
            )
        }
    }

    /**
     * @param {RequestOptions} options
     * @returns {Promise<RequestTextResult>}
     */
    async requestText(options) {
        const requestURL = new URL(options.path, `${this.baseURL}/`)
        if (options.query !== undefined) {
            requestURL.search = options.query.toString()
        }

        /** @type {Record<string, string>} */
        const headers = {
            Accept: options.accept ?? "*/*",
            "User-Agent": this.userAgent,
        }

        if (options.skipAuthHeader !== true) {
            if (this.agentToken !== "") {
                headers["X-Agent-Token"] = this.agentToken
            } else if (this.workflowToken !== "") {
                headers["X-Workflow-Token"] = this.workflowToken
            } else if (this.projectToken !== "") {
                headers["X-Project-Token"] = this.projectToken
            }
        }

        if (options.body !== undefined) {
            headers["Content-Type"] = "application/json"
        }

        /** @type {RequestInit} */
        const requestInit = {
            method: options.method,
            headers,
        }

        if (options.body !== undefined) {
            requestInit.body = JSON.stringify(options.body)
        }

        if (options.timeoutMs !== undefined) {
            requestInit.signal = AbortSignal.timeout(options.timeoutMs)
        }

        let response
        try {
            response = await fetch(requestURL, requestInit)
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            throw new Error(`Control plane request failed: ${options.method} ${options.path} (network error: ${reason})`)
        }

        const responseText = await response.text()
        if (response.ok) {
            return {
                status: response.status,
                responseText,
            }
        }

        const detail = getApiErrorDetail(responseText)
        const statusDetail = detail === "" ? `HTTP ${response.status}` : `HTTP ${response.status}: ${detail}`
        throw new Error(`Control plane request failed: ${options.method} ${options.path} (${statusDetail})`)
    }
}

/**
 * @param {string} responseText
 * @returns {string}
 */
function getApiErrorDetail(responseText) {
    const trimmed = responseText.trim()
    if (trimmed === "") {
        return ""
    }

    try {
        const parsed = JSON.parse(trimmed)

        const maybeApiError = API_ERROR_SCHEMA.safeParse(parsed)
        if (maybeApiError.success) {
            return maybeApiError.data.error
        }

        const validationError = getValidationErrorDetail(parsed)
        if (validationError !== null) {
            return validationError
        }
    } catch {
        // Ignore JSON parse errors and use raw text response instead.
    }

    return trimmed
}

/**
 * @param {unknown} payload
 * @returns {string|null}
 */
function getValidationErrorDetail(payload) {
    if (typeof payload !== "object" || payload === null) {
        return null
    }

    const maybePayload = /** @type {{ message?: unknown, errors?: unknown }} */ (payload)

    const message = typeof maybePayload.message === "string" ? maybePayload.message.trim() : ""

    if (typeof maybePayload.errors !== "object" || maybePayload.errors === null || Array.isArray(maybePayload.errors)) {
        return message === "" ? null : message
    }

    const entries = Object.entries(maybePayload.errors)
    /** @type {string[]} */
    const fieldErrors = []

    for (const [field, value] of entries) {
        if (!Array.isArray(value)) {
            continue
        }

        const messages = value
            .filter(item => typeof item === "string")
            .map(item => item.trim())
            .filter(item => item !== "")

        if (messages.length === 0) {
            continue
        }

        fieldErrors.push(`${field}: ${messages.join(", ")}`)
    }

    if (fieldErrors.length === 0) {
        return message === "" ? null : message
    }

    if (message === "") {
        return fieldErrors.join("; ")
    }

    return `${message}; ${fieldErrors.join("; ")}`
}
