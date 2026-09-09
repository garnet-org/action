/**
 * Structural validation for the network policy the control plane returns.
 *
 * The policy is written to `/etc/jibril/netpolicy.yaml` with root privileges
 * and then consumed by the sensor, so the response is treated as untrusted
 * input: it must look like the expected policy document before it reaches
 * the file system. The check is deliberately a scanner over the small YAML
 * subset the policy uses — the repository ships no YAML parser and this
 * needs no new dependency.
 */

/** Upper bound on a policy document; real policies are a few KiB. */
const MAX_POLICY_BYTES = 1024 * 1024

const ROOT_KEY = "network_policy"
const POLICY_VALUES = ["allow", "deny"]
const KEY_LINE_PATTERN = /^(\s*)([A-Za-z0-9_.-]+):(?:\s+(.*))?$/
const SEQUENCE_LINE_PATTERN = /^(\s*)-(?:\s+(.*))?$/
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_.-]+$/

/**
 * @typedef {{
 *   valid: boolean
 *   error: string
 * }} NetworkPolicyValidation
 */

/**
 * @param {string} content
 * @returns {NetworkPolicyValidation}
 */
export function validateNetworkPolicyYAML(content) {
    if (typeof content !== "string" || content.trim() === "") {
        return invalid("the policy document is empty")
    }

    if (Buffer.byteLength(content, "utf8") > MAX_POLICY_BYTES) {
        return invalid(`the policy document exceeds ${MAX_POLICY_BYTES} bytes`)
    }

    if (CONTROL_CHARACTER_PATTERN.test(content)) {
        return invalid("the policy document contains control characters")
    }

    /** @type {string[]} */
    const rootKeys = []
    /** @type {Map<string, string>} */
    const rootScalars = new Map()
    let rootKeyIndent = -1
    let seenDocumentStart = false
    // Indentation of the key introducing a block scalar (`|` or `>`); its
    // more-indented lines are literal text, not structure.
    let blockScalarIndent = -1

    const lines = content.split(/\r?\n/)
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? ""
        const location = `line ${index + 1}`

        if (line.trim() === "" || line.trimStart().startsWith("#")) {
            continue
        }

        if (line.trimEnd() === "---") {
            if (seenDocumentStart || rootKeys.length > 0) {
                return invalid(`multiple YAML documents are not accepted (${location})`)
            }
            seenDocumentStart = true
            continue
        }

        const indent = line.length - line.trimStart().length
        if (line.slice(0, indent).includes("\t")) {
            return invalid(`tab indentation is not valid YAML (${location})`)
        }

        if (blockScalarIndent !== -1) {
            if (indent > blockScalarIndent) {
                continue
            }
            blockScalarIndent = -1
        }

        const sequenceMatch = SEQUENCE_LINE_PATTERN.exec(line)
        const keyMatch = sequenceMatch === null ? KEY_LINE_PATTERN.exec(line) : null
        if (sequenceMatch === null && keyMatch === null) {
            return invalid(`unexpected content outside the policy structure (${location})`)
        }

        const value = sequenceMatch !== null ? (sequenceMatch[2] ?? "") : (keyMatch?.[3] ?? "")
        const valueError = validateScalar(value, location)
        if (valueError !== "") {
            return invalid(valueError)
        }

        if (keyMatch === null) {
            continue
        }

        if (isBlockScalarIntroducer(value)) {
            blockScalarIndent = indent
            continue
        }

        const key = keyMatch[2] ?? ""
        if (indent === 0) {
            rootKeys.push(key)
            continue
        }

        if (key === ROOT_KEY) {
            continue
        }

        if (rootKeys.length === 1 && rootKeys[0] === ROOT_KEY) {
            if (rootKeyIndent === -1) {
                rootKeyIndent = indent
            }
            if (indent === rootKeyIndent && value !== "") {
                rootScalars.set(key, unquote(value))
            }
        }
    }

    if (rootKeys.length === 0) {
        return invalid("the policy document has no top-level keys")
    }

    if (!rootKeys.includes(ROOT_KEY)) {
        return invalid(`the policy document has no '${ROOT_KEY}' section`)
    }

    const policy = rootScalars.get("policy")
    if (policy !== undefined && !POLICY_VALUES.includes(policy)) {
        return invalid(`'${ROOT_KEY}.policy' must be one of ${POLICY_VALUES.join(", ")}, got ${JSON.stringify(policy)}`)
    }

    const mode = rootScalars.get("mode")
    if (mode !== undefined && !IDENTIFIER_PATTERN.test(mode)) {
        return invalid(`'${ROOT_KEY}.mode' is not a plain identifier: ${JSON.stringify(mode)}`)
    }

    return { valid: true, error: "" }
}

/**
 * Throws with a clear message when the policy is not the expected document.
 * @param {string} content
 * @returns {void}
 */
export function assertValidNetworkPolicyYAML(content) {
    const result = validateNetworkPolicyYAML(content)
    if (result.valid) {
        return
    }

    throw new Error(`Refusing to install a malformed network policy: ${result.error}`)
}

/**
 * YAML anchors, aliases, tags, and directives carry behavior the sensor's
 * policy never needs, so a scalar that starts with one is rejected.
 * @param {string} value
 * @param {string} location
 * @returns {string} an error message, or "" when the scalar is acceptable
 */
function validateScalar(value, location) {
    const trimmed = value.trim()
    if (trimmed === "" || trimmed.startsWith("#")) {
        return ""
    }

    if (trimmed.startsWith("&") || trimmed.startsWith("*") || trimmed.startsWith("!")) {
        return `YAML anchors, aliases, and tags are not accepted (${location})`
    }

    if (trimmed === "...") {
        return `unexpected document end marker (${location})`
    }

    return ""
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isBlockScalarIntroducer(value) {
    return /^[|>][-+0-9]*\s*$/.test(value.trim())
}

/**
 * @param {string} value
 * @returns {string}
 */
function unquote(value) {
    const trimmed = value.trim()
    const quoted = /^"(.*)"$/.exec(trimmed) ?? /^'(.*)'$/.exec(trimmed)
    return quoted === null ? trimmed : (quoted[1] ?? "")
}

/**
 * @param {string} error
 * @returns {NetworkPolicyValidation}
 */
function invalid(error) {
    return { valid: false, error }
}
