import {
    AGENT_CREATED_RESPONSE_SCHEMA,
    API_ERROR_SCHEMA,
    CREATE_AGENT_REQUEST_SCHEMA,
    MERGED_NET_POLICIES_REQUEST_SCHEMA,
} from "./types.js"

/**
 * @typedef {import("./types.js").CreateAgentRequest} CreateAgentRequest
 * @typedef {import("./types.js").AgentCreatedResponse} AgentCreatedResponse
 * @typedef {import("./types.js").MergedNetPoliciesRequest} MergedNetPoliciesRequest
 */

/**
 * @typedef {{
 *   baseURL: string
 *   projectToken: string
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
 * }} RequestOptions
 */

export class ControlPlaneClient {
    /**
     * @param {ControlPlaneClientOptions} options
     */
    constructor(options) {
        if (typeof options.baseURL !== "string" || options.baseURL.trim() === "") {
            throw new Error("ControlPlaneClient: 'baseURL' is required")
        }

        if (typeof options.projectToken !== "string" || options.projectToken.trim() === "") {
            throw new Error("ControlPlaneClient: 'projectToken' is required")
        }

        this.baseURL = options.baseURL.replace(/\/+$/, "")
        this.projectToken = options.projectToken
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

        const responseText = await this.requestText({
            method: "GET",
            path: "/api/v1/network_policies/merged",
            query,
            accept: "application/x-yaml, text/yaml, text/plain, */*",
        })

        if (responseText.trim() === "") {
            throw new Error(
                "Control plane request failed: GET /api/v1/network_policies/merged (HTTP 200: empty response body)",
            )
        }

        return responseText
    }

    /**
     * @param {RequestOptions} options
     * @returns {Promise<unknown>}
     */
    async requestJson(options) {
        const responseText = await this.requestText({
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
                `Control plane request failed: ${options.method} ${options.path} (HTTP 200: expected JSON but received non-JSON response)`,
            )
        }
    }

    /**
     * @param {RequestOptions} options
     * @returns {Promise<string>}
     */
    async requestText(options) {
        const requestUrl = new URL(options.path, `${this.baseURL}/`)
        if (options.query !== undefined) {
            requestUrl.search = options.query.toString()
        }

        /** @type {Record<string, string>} */
        const headers = {
            Accept: options.accept ?? "*/*",
            "User-Agent": this.userAgent,
            "X-Project-Token": this.projectToken,
        }

        if (options.body !== undefined) {
            headers["Content-Type"] = "application/json"
        }

        let response
        try {
            if (options.body === undefined) {
                response = await fetch(requestUrl, {
                    method: options.method,
                    headers,
                })
            } else {
                response = await fetch(requestUrl, {
                    method: options.method,
                    headers,
                    body: JSON.stringify(options.body),
                })
            }
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            throw new Error(
                `Control plane request failed: ${options.method} ${options.path} (network error: ${reason})`,
            )
        }

        const responseText = await response.text()
        if (!response.ok) {
            const detail = getApiErrorDetail(responseText)
            const statusDetail = detail === "" ? `HTTP ${response.status}` : `HTTP ${response.status}: ${detail}`
            throw new Error(`Control plane request failed: ${options.method} ${options.path} (${statusDetail})`)
        }

        return responseText
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
