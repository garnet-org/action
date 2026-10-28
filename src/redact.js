// Removes secrets such as API tokens, passwords, and authorization headers
// from profile payloads and log output before they are stored or emitted.

import { getOptionalRecord, isRecord } from "./shared.js"

/**
 * @typedef {object} RedactRule
 * @property {RegExp} re
 * @property {string} repl
 */

const MASK = "***"

// Rules err on the side of over-masking: a redacted value that turned out to be
// harmless only costs a little telemetry, whereas a missed one is a leak. Every
// rule must be idempotent, so re-running over already masked text is a no-op.
//
// Length bounds are open-ended on purpose. Providers lengthen token formats
// over time, and an exact bound such as {36} silently matches nothing at all
// once a token grows by one character.
//
// SECRET_FLAG matches a command line flag whose name denotes a secret, up to
// and including the separator, e.g. "--token ", "--password=", "--api-key ".
// Single-letter flags are left out: they are far too ambiguous.
const SECRET_FLAG =
    "(--?(?:[a-z0-9-]*-)?(?:token|secret|password|passwd|passphrase|credentials?|auth|" +
    "api[_-]?key|access[_-]?key|private[_-]?key)[= ]\\s*)"

/** @type {RedactRule[]} */
const RULES = [
    // NAME=VALUE assignments where the name denotes a secret, e.g.
    // GITHUB_TOKEN=abc, MY_SECRET=xyz, DB_PASSWORD=p, API_KEY=k,
    // NODE_AUTH=t, SSH_KEY=k. The value may be bare or single/double quoted.
    {
        re: /\b([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|PASSWD|PASSPHRASE|CREDENTIALS?|AUTH|(?:API|ACCESS|PRIVATE|SECRET|ENCRYPTION|SIGNING|CLIENT|CONSUMER|AUTH|SSH|GPG|PGP|DEPLOY)[_-]?KEY))=(?:"[^"]*"|'[^']*'|[^\s'"]+)/gi,
        repl: `$1=${MASK}`,
    },
    // Command line flags carrying a secret, e.g. --token xyz, --password=p,
    // --api-key k. Quotes are kept so the surrounding command stays readable.
    {
        re: new RegExp(`${SECRET_FLAG}"[^"]*"`, "gi"),
        repl: `$1"${MASK}"`,
    },
    {
        re: new RegExp(`${SECRET_FLAG}'[^']*'`, "gi"),
        repl: `$1'${MASK}'`,
    },
    // A bare flag value. The terminator is matched and put back so that a
    // value containing '=' never matches: those are assignments such as
    // --token GITHUB_TOKEN=abc, which the first rule already masks more
    // precisely. A value that is only a shell variable reference such as
    // $GITHUB_TOKEN reveals nothing, so it stays readable.
    {
        re: new RegExp(`${SECRET_FLAG}[^\\s'"$=]+(\\s|['"]|$)`, "gi"),
        repl: `$1${MASK}$2`,
    },
    // HTTP authorization headers: Authorization: Bearer/Token/Basic/Digest xxx.
    {
        re: /(authorization\s*:\s*(?:bearer|token|basic|digest)\s+)[^\s'"]+/gi,
        repl: `$1${MASK}`,
    },
    // Sensitive headers and JSON/YAML fields with a quoted value, e.g.
    // "api_key": "xxx". The quotes are kept so the result stays parseable and
    // so a second pass is a no-op.
    {
        re: /\b((?:x-)?(?:api[_-]?key|api[_-]?token|auth[_-]?token|access[_-]?token|session[_-]?token|refresh[_-]?token|csrf[_-]?token|private[_-]?key)"?\s*:\s*)"[^"]*"/gi,
        repl: `$1"${MASK}"`,
    },
    // The same fields with a bare value, e.g. X-API-Token: xxx.
    {
        re: /\b((?:x-)?(?:api[_-]?key|api[_-]?token|auth[_-]?token|access[_-]?token|session[_-]?token|refresh[_-]?token|csrf[_-]?token|private[_-]?key)\s*:\s*)[^\s'"]+/gi,
        repl: `$1${MASK}`,
    },
    // Well-known token formats that can leak without a name or header.
    {
        re: /\bghs_[A-Za-z0-9_.-]{36,}/g,
        repl: MASK,
    },
    {
        re: /\bgh[pour]_[A-Za-z0-9]{36,}\b/g,
        repl: MASK,
    },
    {
        re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g,
        repl: MASK,
    },
    {
        re: /\bnpm_[A-Za-z0-9]{36,}\b/g,
        repl: MASK,
    },
    // AWS key IDs: AKIA is the long-lived form, ASIA a session credential and
    // the rest identify other principal types.
    {
        re: /\b(?:AKIA|ASIA|ABIA|ACCA|AGPA|AIDA|AIPA|ANPA|ANVA|AROA)[0-9A-Z]{16,}\b/g,
        repl: MASK,
    },
    // Slack bot, user, app and refresh tokens.
    {
        re: /\b(?:xox[abeprs]|xapp)-[A-Za-z0-9-]{10,}\b/g,
        repl: MASK,
    },
    {
        re: /\bAIza[0-9A-Za-z_-]{35,}\b/g,
        repl: MASK,
    },
    // Stripe secret and restricted keys.
    {
        re: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{10,}\b/g,
        repl: MASK,
    },
    // JSON web tokens, which is what most short-lived CI credentials look like
    // once they are expanded, e.g. ACTIONS_RUNTIME_TOKEN.
    {
        re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
        repl: MASK,
    },
    {
        re: /-----BEGIN[A-Z ]*PRIVATE KEY-----[\s\S]*?-----END[A-Z ]*PRIVATE KEY-----/g,
        repl: MASK,
    },
]

/**
 * Returns `value` with any detected secrets replaced by a mask.
 * @param {string} value
 * @returns {string}
 */
export function redactString(value) {
    if (value === "") {
        return value
    }

    let redacted = value
    for (const rule of RULES) {
        redacted = redacted.replace(rule.re, rule.repl)
    }

    return redacted
}

/**
 * Returns a copy of `base` with secrets removed from the fields that can carry
 * user-controlled command lines, arguments, and environment variables.
 * The input is not modified.
 * @template T
 * @param {T} base
 * @returns {T}
 */
export function redactBase(base) {
    if (!isRecord(base) || Array.isArray(base)) {
        return base
    }

    const cloned = structuredClone(base)
    const root = getOptionalRecord(cloned)
    if (root === null) {
        return cloned
    }

    redactBackground(getOptionalRecord(root.background))

    return cloned
}

/**
 * Returns a copy of `profile` with secrets removed from the fields that can
 * carry user-controlled command lines, arguments, and environment variables.
 * The input is not modified.
 * @template T
 * @param {T} profile
 * @returns {T}
 */
export function redactProfile(profile) {
    if (!isRecord(profile) || Array.isArray(profile)) {
        return profile
    }

    const cloned = structuredClone(profile)
    const root = getOptionalRecord(cloned)
    if (root === null) {
        return cloned
    }

    redactBackground(getOptionalRecord(root.background))
    redactNetProfile(getOptionalRecord(root.network))
    redactAssertions(root.assertions)
    redactProfileDetections(root.profile_detections)

    return cloned
}

/**
 * @param {Record<string, unknown> | null} netProfile
 * @returns {void}
 */
function redactNetProfile(netProfile) {
    if (netProfile === null) {
        return
    }

    redactDirection(getOptionalRecord(netProfile.egress))
    redactDirection(getOptionalRecord(netProfile.ingress))
    redactDirection(getOptionalRecord(netProfile.local))
}

/**
 * @param {Record<string, unknown> | null} direction
 * @returns {void}
 */
function redactDirection(direction) {
    if (direction === null || !Array.isArray(direction.peers)) {
        return
    }

    for (const item of direction.peers) {
        const peer = getOptionalRecord(item)
        if (peer !== null) {
            redactProcTrees(peer.proc_trees)
        }
    }
}

/**
 * @param {unknown} assertions
 * @returns {void}
 */
function redactAssertions(assertions) {
    if (!Array.isArray(assertions)) {
        return
    }

    for (const assertionItem of assertions) {
        const assertion = getOptionalRecord(assertionItem)
        if (assertion === null || !Array.isArray(assertion.evidence)) {
            continue
        }

        for (const evidenceItem of assertion.evidence) {
            const evidence = getOptionalRecord(evidenceItem)
            if (evidence === null) {
                continue
            }

            const peer = getOptionalRecord(evidence.peer)
            if (peer !== null) {
                redactProcTrees(peer.proc_trees)
            }
        }
    }
}

/**
 * @param {unknown} profileDetections
 * @returns {void}
 */
function redactProfileDetections(profileDetections) {
    if (!Array.isArray(profileDetections)) {
        return
    }

    for (const detectionItem of profileDetections) {
        const detection = getOptionalRecord(detectionItem)
        if (detection === null || !Array.isArray(detection.digested_detections)) {
            continue
        }

        for (const digestedItem of detection.digested_detections) {
            const digested = getOptionalRecord(digestedItem)
            if (digested !== null) {
                redactProcTrees(digested.proc_trees)
            }
        }
    }
}

/**
 * @param {unknown} trees
 * @returns {void}
 */
function redactProcTrees(trees) {
    if (!Array.isArray(trees)) {
        return
    }

    for (const item of trees) {
        const tree = getOptionalRecord(item)
        if (tree !== null) {
            redactRecordStringField(tree, "arguments")
        }
    }
}

/**
 * @param {Record<string, unknown> | null} background
 * @returns {void}
 */
function redactBackground(background) {
    if (background === null) {
        return
    }

    if (Array.isArray(background.ancestry)) {
        for (const item of background.ancestry) {
            const process = getOptionalRecord(item)
            if (process === null) {
                continue
            }

            redactRecordStringField(process, "cmd")
            redactRecordStringField(process, "args")
            redactRecordStringField(process, "envs")
            redactRecordStringField(process, "prev_args")
            redactRecordStringField(process, "prev_envs")
        }
    }

    const containersWrapper = getOptionalRecord(background.containers)
    if (containersWrapper !== null && Array.isArray(containersWrapper.containers)) {
        for (const item of containersWrapper.containers) {
            const container = getOptionalRecord(item)
            if (container === null) {
                continue
            }

            redactStringArray(container.cmd)
            redactStringArray(container.env)
        }
    }
}

/**
 * @param {Record<string, unknown>} record
 * @param {string} key
 * @returns {void}
 */
function redactRecordStringField(record, key) {
    const value = record[key]
    if (typeof value === "string") {
        record[key] = redactString(value)
    }
}

/**
 * @param {unknown} list
 * @returns {void}
 */
function redactStringArray(list) {
    if (!Array.isArray(list)) {
        return
    }

    for (let i = 0; i < list.length; i += 1) {
        const value = list[i]
        if (typeof value === "string") {
            list[i] = redactString(value)
        }
    }
}
