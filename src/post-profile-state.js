import { parseProfileJson } from "./profile-comment.js"
import { getErrorMessage } from "./shared.js"

/** @typedef {import("./profile-comment.js").NormalizedProfile} NormalizedProfile */

/**
 * @typedef {object} RootFileStat
 * @property {boolean} exists
 * @property {number} size
 */

/**
 * @typedef {object} LoadedProfile
 * @property {NormalizedProfile} normalized
 * @property {unknown} raw
 */

/**
 * @typedef {"present" | "missing" | "empty" | "invalid"} ProfileState
 */

/**
 * @typedef {object} ProfileResult
 * @property {ProfileState} state
 * @property {LoadedProfile | null} profile
 * @property {string} detail
 */

/**
 * @param {RootFileStat} stat
 * @param {string} content
 * @returns {ProfileResult}
 */
export function classifyProfileContent(stat, content) {
    if (!stat.exists) {
        return {
            state: "missing",
            profile: null,
            detail: "profile file missing",
        }
    }

    if (stat.size === 0) {
        return {
            state: "empty",
            profile: null,
            detail: "profile file empty",
        }
    }

    if (content.trim() === "") {
        return {
            state: "empty",
            profile: null,
            detail: "profile file empty",
        }
    }

    try {
        const normalized = parseProfileJson(content)
        const raw = JSON.parse(content)

        return {
            state: "present",
            profile: {
                normalized,
                raw,
            },
            detail: "",
        }
    } catch (error) {
        return {
            state: "invalid",
            profile: null,
            detail: getErrorMessage(error),
        }
    }
}

/**
 * Maps a classified profile to the public garnet_status value: only a parsed,
 * non-empty profile counts as recorded.
 * @param {ProfileState} state
 * @returns {import("./garnet-status.js").GarnetStatus}
 */
export function garnetStatusFromProfileState(state) {
    if (state === "present") {
        return "recorded"
    }
    return "no_profile"
}
