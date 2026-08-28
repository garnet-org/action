import * as fs from "node:fs/promises"

// Hostnames a plaintext control plane may run on during local development.
const LOCAL_API_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"]

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
 * @param {unknown} value
 * @returns {string | undefined}
 */
export function getOptionalString(value) {
  return typeof value === "string" && value !== "" ? value : undefined
}

/**
 * @param {unknown} value
 * @returns {number | undefined}
 */
export function getOptionalNumber(value) {
  return typeof value === "number" ? value : undefined
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

/**
 * The control-plane origin carries the project token and the OIDC exchange,
 * so it must be an `https:` URL. Plain `http:` is tolerated only for a local
 * control plane, where nothing leaves the machine.
 * @param {string} apiURL
 * @returns {void}
 */
export function assertSecureApiURL(apiURL) {
  /** @type {URL} */
  let parsed
  try {
    parsed = new URL(apiURL)
  } catch {
    throw new Error(`Invalid 'api_url' input: ${JSON.stringify(apiURL)} is not a URL.`)
  }

  if (parsed.protocol === "https:") {
    return
  }

  if (parsed.protocol === "http:" && LOCAL_API_HOSTNAMES.includes(parsed.hostname)) {
    return
  }

  throw new Error(
    `Refusing to send credentials to ${JSON.stringify(apiURL)}: 'api_url' must use https ` +
      `(http is allowed only for ${LOCAL_API_HOSTNAMES.join(", ")}).`,
  )
}
