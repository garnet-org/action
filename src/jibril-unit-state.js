import * as core from "@actions/core"
import * as exec from "@actions/exec"
import { getErrorMessage } from "./shared.js"

/** @typedef {import("./post-signal.js").JibrilUnitState} JibrilUnitState */

/**
 * Reads the jibril unit state for diagnostics and stop-reason classification.
 * @returns {Promise<JibrilUnitState | null>}
 */
export async function readJibrilUnitState() {
    try {
        const result = await exec.getExecOutput(
            "sudo",
            ["systemctl", "show", "jibril.service", "-p", "ActiveState", "-p", "Result", "-p", "ExecMainStatus"],
            {
                silent: true,
                ignoreReturnCode: true,
            },
        )
        if (result.exitCode !== 0) {
            return null
        }

        const properties = parseSystemctlProperties(result.stdout)
        return {
            activeState: properties.get("ActiveState") ?? "",
            result: properties.get("Result") ?? "",
            execMainStatus: parseExecMainStatus(properties.get("ExecMainStatus")),
        }
    } catch (error) {
        core.info(`could not read jibril service state: ${getErrorMessage(error)}`)
        return null
    }
}

/**
 * Parses the `key=value` lines printed by `systemctl show`.
 * @param {string} output
 * @returns {Map<string, string>}
 */
function parseSystemctlProperties(output) {
    /** @type {Map<string, string>} */
    const properties = new Map()

    for (const line of output.split("\n")) {
        const separatorIndex = line.indexOf("=")
        if (separatorIndex === -1) {
            continue
        }
        properties.set(line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim())
    }

    return properties
}

/**
 * @param {string | undefined} value
 * @returns {number}
 */
function parseExecMainStatus(value) {
    const parsedValue = Number.parseInt(value ?? "", 10)
    return Number.isSafeInteger(parsedValue) ? parsedValue : 0
}
