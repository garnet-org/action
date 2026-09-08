// Resolution of the post step's `systemctl stop` bound. Zero means the bound
// is disabled and the post step waits for the flush without a ceiling.

const FALLBACK_STOP_TIMEOUT_SECONDS = 1800
const STOP_TIMEOUT_GRACE_SECONDS = 30

/**
 * @typedef {object} StopTimeoutSettings
 * @property {string} envOverride
 * @property {string} savedState
 */

/**
 * Resolves the bound from the values the action itself controls: the env
 * escape hatch (used verbatim) then the ceiling the main step saved. Returns
 * null when neither is set, so the caller knows it still has to ask the unit.
 * @param {StopTimeoutSettings} settings
 * @returns {number | null} seconds, 0 when disabled, null when unresolved
 */
export function resolveStopTimeoutFromSettings(settings) {
    const envOverride = parseTimeoutSetting(settings.envOverride)
    if (envOverride !== null) {
        return envOverride > 0 ? envOverride : 0
    }

    const savedState = parseTimeoutSetting(settings.savedState)
    if (savedState !== null) {
        return savedState > 0 ? savedState + STOP_TIMEOUT_GRACE_SECONDS : 0
    }

    return null
}

/**
 * Resolves the bound for runs whose saved state predates `stopTimeoutSeconds`,
 * from the unit's own TimeoutStopSec. An unreadable or infinite unit value
 * keeps the historical fallback rather than removing the ceiling entirely.
 * @param {number | null} unitTimeoutSeconds
 * @returns {number} seconds
 */
export function resolveStopTimeoutFromUnit(unitTimeoutSeconds) {
    const seconds = unitTimeoutSeconds === null ? FALLBACK_STOP_TIMEOUT_SECONDS : unitTimeoutSeconds
    return seconds + STOP_TIMEOUT_GRACE_SECONDS
}

/**
 * @param {string} value
 * @returns {number | null}
 */
function parseTimeoutSetting(value) {
    const text = value.trim()
    if (!/^-?\d+$/.test(text)) {
        return null
    }

    const parsedValue = Number.parseInt(text, 10)
    return Number.isSafeInteger(parsedValue) ? parsedValue : null
}
