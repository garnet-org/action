import * as core from "@actions/core"

/**
 * @typedef {"recorded" | "start_failed" | "no_profile"} GarnetStatus
 */

export const GARNET_STATUS_OUTPUT = "garnet_status"
export const GARNET_STATUS_STATE = "garnetStatus"

/**
 * Writes the status to $GITHUB_OUTPUT and to action state so the post step
 * can read it back.
 * @param {GarnetStatus} status
 * @returns {void}
 */
export function publishGarnetStatus(status) {
    core.setOutput(GARNET_STATUS_OUTPUT, status)
    core.saveState(GARNET_STATUS_STATE, status)
}
