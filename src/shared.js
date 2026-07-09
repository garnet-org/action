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
 * @param {...unknown} values
 * @returns {string}
 */
export function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value !== "") {
      return value
    }
  }

  return ""
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

/**
 * @param {number} delayMs
 * @returns {Promise<void>}
 */
export function waitForDelay(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

/**
 * Returns true only on Linux, where Jibril (eBPF-based) can run.
 * @param {string} platform - value from os.platform()
 * @returns {boolean}
 */
export function isSupportedPlatform(platform) {
  return platform === "linux"
}

/**
 * Returns true only on x86_64, the only architecture jibril is built for.
 * @param {string} arch - value from os.arch()
 * @returns {boolean}
 */
export function isSupportedArch(arch) {
  return arch === "x64" || arch === "x86_64"
}
