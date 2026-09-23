import * as core from "@actions/core"
import * as fs from "node:fs/promises"
import { getEnv, getErrorMessage } from "./shared.js"

/**
 * @param {string} reason
 * @returns {Promise<void>}
 */
export async function appendUnrecordedSummary(reason) {
    const summaryFile = getEnv("GITHUB_STEP_SUMMARY")
    if (summaryFile === "") {
        core.info("GITHUB_STEP_SUMMARY is not set; skipping unrecorded-job summary")
        return
    }

    try {
        await fs.appendFile(summaryFile, `\n${renderUnrecordedSummary(reason)}\n`)
    } catch (error) {
        core.info(`job summary not written: ${getErrorMessage(error)}`)
    }
}

/**
 * @param {string} reason
 * @returns {string}
 */
export function renderUnrecordedSummary(reason) {
    const escaped = reason
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        // Intra-word underscores (e.g. "no_profile") are not emphasis in GitHub
        // markdown, so they are left literal to keep status tokens readable verbatim.
        .replace(/[\\`*[\]!]/g, "\\$&")
    return ["**Execution Profile for this job · not recorded**", "", escaped].join("\n")
}
