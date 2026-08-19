// GitHub OIDC helpers shared by the main and post steps. Each step requests
// its own ID token so no exchanged credential is ever persisted to runner
// state between steps.

import * as core from "@actions/core"
import { getErrorMessage } from "./shared.js"

export const OIDC_AUTH_FEATURE_FLAG = "GARNET_ACTION_ENABLE_OIDC_AUTH"

const GITHUB_APP_ID_PROD = "Iv23lihCfwCfqCxQNpvv"
const GITHUB_APP_ID_STAGING = "Iv23liUXLYx9mgGKHgZk"
const GITHUB_APP_ID_DEV = "Iv23li88DidEyxVnAR1p"

/**
 * @param {string} apiURL
 * @returns {string}
 */
export function resolveOIDCAudience(apiURL) {
    try {
        const url = new URL(apiURL)
        if (url.host === "api.garnet.ai") {
            return GITHUB_APP_ID_PROD
        }
        if (url.host === "staging-api.garnet.ai") {
            return GITHUB_APP_ID_STAGING
        }
        if (url.host === "dev-api.garnet.ai") {
            return GITHUB_APP_ID_DEV
        }

        return GITHUB_APP_ID_DEV
    } catch {
        return GITHUB_APP_ID_DEV
    }
}

/**
 * @param {string} audience
 * @returns {Promise<string>}
 */
export async function getGitHubIDToken(audience) {
    let idToken = ""

    try {
        idToken = await core.getIDToken(audience)
    } catch (error) {
        const errorMessage = getErrorMessage(error)
        if (isMissingOIDCPermissionError(errorMessage)) {
            throw new Error("OIDC token request failed because this workflow is missing 'id-token: write' permission")
        }

        throw new Error(`OIDC token request failed: ${errorMessage}`)
    }

    if (idToken.trim() === "") {
        throw new Error("OIDC token request returned an empty token")
    }

    return idToken
}

/**
 * @param {string} errorMessage
 * @returns {boolean}
 */
export function isMissingOIDCPermissionError(errorMessage) {
    const normalized = errorMessage.toLowerCase()
    if (normalized.includes("actions_id_token_request_url")) {
        return true
    }
    if (normalized.includes("id-token") && normalized.includes("permission")) {
        return true
    }
    return false
}
