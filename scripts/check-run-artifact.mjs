// Validates the run artifacts collected from a workflow run, the way the
// Garnet GitHub App does: every `garnet-run-*` artifact must carry exactly
// one readable `garnet/run.json` envelope, and the fields the App verifies
// against GitHub must match this run.
//
// Usage: node scripts/check-run-artifact.mjs <collected-dir>
//
// <collected-dir> holds one subdirectory per artifact, named after it.

import { readFileSync, readdirSync, statSync } from "node:fs"
import { isIP } from "node:net"
import { join } from "node:path"

const STOP_REASONS = ["run_cancelled", "crashed", "flush_timeout", "stopped_cleanly", "start_failed"]
const PROFILE_STATES = ["present", "missing", "empty", "invalid"]

/** @type {string[]} */
const failures = []

/**
 * @param {boolean} condition
 * @param {string} message
 */
function check(condition, message) {
    if (!condition) {
        failures.push(message)
    }
}

/**
 * @param {string} artifactName
 * @param {Record<string, unknown>} context
 */
function checkGitHubContext(artifactName, context) {
    for (const field of ["job", "run_id", "workflow", "repository", "repository_id"]) {
        check(
            typeof context[field] === "string" && context[field] !== "",
            `${artifactName}: github_context.${field} must be a non-empty string, got ${JSON.stringify(context[field])}`,
        )
    }

    // The App rejects the whole envelope when these disagree with what
    // GitHub reports for the run.
    for (const [field, expected] of [
        ["run_id", process.env.GITHUB_RUN_ID],
        ["run_attempt", process.env.GITHUB_RUN_ATTEMPT],
        ["repository", process.env.GITHUB_REPOSITORY],
        ["repository_id", process.env.GITHUB_REPOSITORY_ID],
        ["repository_owner_id", process.env.GITHUB_REPOSITORY_OWNER_ID],
    ]) {
        check(
            context[field] === expected,
            `${artifactName}: github_context.${field} is ${JSON.stringify(context[field])}, expected ${JSON.stringify(expected)}`,
        )
    }

    check(
        Number.isInteger(context.job_index) && Number(context.job_index) >= 0,
        `${artifactName}: github_context.job_index must be a non-negative integer, got ${JSON.stringify(context.job_index)}`,
    )
}

/**
 * @param {string} artifactName
 * @param {Record<string, unknown>} envelope
 */
function checkEnvelope(artifactName, envelope) {
    check(envelope.schema_version === 1, `${artifactName}: schema_version must be 1, got ${envelope.schema_version}`)

    const agent = envelope.agent
    if (typeof agent !== "object" || agent === null) {
        failures.push(`${artifactName}: agent must be an object`)
        return
    }

    const record = /** @type {Record<string, unknown>} */ (agent)
    for (const field of ["os", "arch", "hostname", "version", "machine_id"]) {
        check(
            typeof record[field] === "string" && record[field] !== "",
            `${artifactName}: agent.${field} must be a non-empty string, got ${JSON.stringify(record[field])}`,
        )
    }

    check(record.kind === "github", `${artifactName}: agent.kind must be "github", got ${JSON.stringify(record.kind)}`)
    check(
        typeof record.ip === "string" && isIP(record.ip) !== 0,
        `${artifactName}: agent.ip must parse as an IP, got ${JSON.stringify(record.ip)}`,
    )

    const context = record.github_context
    if (typeof context !== "object" || context === null) {
        failures.push(`${artifactName}: agent.github_context must be an object`)
    } else {
        checkGitHubContext(artifactName, /** @type {Record<string, unknown>} */ (context))
    }

    const stopped = envelope.stopped
    if (typeof stopped !== "object" || stopped === null) {
        failures.push(`${artifactName}: stopped must be an object`)
    } else {
        const stop = /** @type {Record<string, unknown>} */ (stopped)
        check(
            STOP_REASONS.includes(String(stop.reason)),
            `${artifactName}: stopped.reason is ${JSON.stringify(stop.reason)}`,
        )
        check(
            PROFILE_STATES.includes(String(stop.profileState)),
            `${artifactName}: stopped.profileState is ${JSON.stringify(stop.profileState)}`,
        )
    }

    check(
        envelope.profile === null || typeof envelope.profile === "object",
        `${artifactName}: profile must be an object or null`,
    )
}

const [collectedDir] = process.argv.slice(2)
if (collectedDir === undefined) {
    console.error("usage: node scripts/check-run-artifact.mjs <collected-dir>")
    process.exit(2)
}

const artifactNames = readdirSync(collectedDir).filter(name => statSync(join(collectedDir, name)).isDirectory())
if (artifactNames.length === 0) {
    console.error(`No garnet-run-* artifacts were collected from ${collectedDir}. The relay produced nothing.`)
    process.exit(1)
}

/** @type {Set<unknown>} */
const jobIndexes = new Set()

for (const artifactName of artifactNames.sort()) {
    check(artifactName.startsWith("garnet-run-"), `${artifactName}: name must start with "garnet-run-"`)

    const entryPath = join(collectedDir, artifactName, "garnet", "run.json")
    let envelope
    try {
        envelope = JSON.parse(readFileSync(entryPath, "utf8"))
    } catch (error) {
        failures.push(`${artifactName}: cannot read garnet/run.json (${String(error)})`)
        continue
    }

    checkEnvelope(artifactName, envelope)
    jobIndexes.add(envelope?.agent?.github_context?.job_index)

    const hasProfile = envelope?.profile !== null && envelope?.profile !== undefined
    console.log(
        `${artifactName}: job_index=${envelope?.agent?.github_context?.job_index} ` +
            `profileState=${envelope?.stopped?.profileState} profile=${hasProfile ? "present" : "null"}`,
    )
}

check(
    jobIndexes.size === artifactNames.length,
    `matrix legs must not share a job_index: ${artifactNames.length} artifacts, ${jobIndexes.size} distinct indexes`,
)

if (failures.length > 0) {
    console.error(`\n${failures.length} problem(s) with the collected run artifacts:`)
    for (const failure of failures) {
        console.error(`  - ${failure}`)
    }
    process.exit(1)
}

console.log(`\nAll ${artifactNames.length} run artifact(s) are well-formed.`)
