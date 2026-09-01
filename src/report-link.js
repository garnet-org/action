const DEFAULT_JSON_PROFILE_FILE = "/var/log/jibril.profile.json"
const DEFAULT_APP_BASE_URL = "https://app.garnet.ai"
const UTM_SOURCE = "github"
const UTM_MEDIUM = "ci_log"

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
