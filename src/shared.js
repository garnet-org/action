import * as fs from "node:fs/promises"

/**
 * @param {string} name
 * @param {string=} def
 * @returns {string}
 */
export function getEnv(name, def = "") {
  return process.env[name] ?? def
}

/**
 * @param {unknown} err
 * @returns {string}
 */
export function getErrorMessage(err) {
  if (err instanceof Error) {
    return err.message
  }

  return String(err)
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isRecord(value) {
  return typeof value === "object" && value !== null
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
export function getOptionalRecord(value) {
  return isRecord(value) ? value : null
}

/**
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
export async function pathExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}