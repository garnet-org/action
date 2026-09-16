/**
 * @typedef {object} JibrilCoreVersion
 * @property {number} major
 * @property {number} minor
 * @property {number} patch
 */

/**
 * Compares a jibril release tag against a minimum version, so every
 * version-gated feature reads as one line where it is used:
 *
 *     // jibril writes its readiness status files from v2.17.0 on.
 *     if (versionAtLeast(version, 2, 17, 0)) {
 *         // ...
 *     }
 *
 * Prereleases sort with their core version, so v2.17.0-rc.5 satisfies
 * (2, 17, 0). "latest" satisfies every minimum: it is whatever jibril
 * released most recently, and a gate is only ever written for a version that
 * is already out. Any other non-semver tag is older than every minimum, so
 * daily builds (v0.0) and an unresolved version ("") leave gated features
 * off rather than guessing.
 * @param {string} tag - a release tag, or "latest"
 * @param {number} major
 * @param {number} minor
 * @param {number} patch
 * @returns {boolean}
 */
export function versionAtLeast(tag, major, minor, patch) {
    if (tag.trim().toLowerCase() === "latest") return true

    const version = parseCoreVersion(tag)
    if (version === null) return false

    if (version.major !== major) return version.major > major
    if (version.minor !== minor) return version.minor > minor
    return version.patch >= patch
}

/**
 * Ignores any prerelease or build suffix.
 * @param {string} tag
 * @returns {JibrilCoreVersion|null}
 */
function parseCoreVersion(tag) {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(tag.trim())
    if (match === null) return null

    const [, major = "0", minor = "0", patch = "0"] = match
    return { major: Number(major), minor: Number(minor), patch: Number(patch) }
}
