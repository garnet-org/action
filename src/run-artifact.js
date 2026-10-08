// A fork's pull request gets neither repository secrets nor an OIDC ID
// token, so the job cannot reach the control plane at all. It can still
// upload a workflow artifact, which the Garnet GitHub App collects
// afterwards with its own credentials.

import * as core from "@actions/core"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { default as artifactClient } from "@actions/artifact"
import { getErrorMessage, getOptionalRecord } from "./shared.js"

/** @typedef {import("./control-plane/types.js").CreateAgentRequest} CreateAgentRequest */
/** @typedef {import("./control-plane/types.js").AgentStoppedRequest} AgentStoppedRequest */
/** @typedef {import("./control-plane/types.js").GitHubRunArtifact} GitHubRunArtifact */

/**
 * @typedef {object} RunArtifactInput
 * @property {CreateAgentRequest} agent
 * @property {number | null} jobIndex
 * @property {unknown} profile - the parsed jibril JSON profile, or null
 * @property {AgentStoppedRequest} stopped
 */

/**
 * @typedef {object} RunArtifactNameInput
 * @property {string} job
 * @property {number | null} jobIndex
 * @property {string} uniqueSuffix
 */

/**
 * @typedef {object} SerializedRunArtifact
 * @property {string} content
 * @property {boolean} profileOmitted
 */

const ARTIFACT_NAME_PREFIX = "garnet-run-"
const ARTIFACT_ENTRY_PATH = "garnet/run.json"

// Over this the App drops the envelope, silently and without retrying.
const MAX_ARTIFACT_BYTES = 16 * 1024 * 1024

const MAX_JOB_NAME_LENGTH = 64
const MAX_UINT32 = 0xffffffff

/**
 * The matrix leg index jibril recorded in the profile's github scenario, or
 * null when it recorded none. jibril is the only source: GitHub exposes
 * `strategy.job-index` to workflow expressions but never to a running step.
 *
 * Absent is reported as absent and never defaulted to 0. jibril leaves the
 * field nil on matrix legs too, so a 0 here would claim "this is leg 0"
 * about a job that may well be leg 3.
 * @param {unknown} profile
 * @returns {number | null}
 */
export function readProfileJobIndex(profile) {
    const root = getOptionalRecord(profile)
    if (root === null) {
        return null
    }

    const scenarios = getOptionalRecord(root.scenarios)
    const github = scenarios === null ? getOptionalRecord(root.github) : getOptionalRecord(scenarios.github)
    if (github === null) {
        return null
    }

    const jobIndex = github.job_index
    if (typeof jobIndex !== "number" || !Number.isInteger(jobIndex) || jobIndex < 0 || jobIndex > MAX_UINT32) {
        return null
    }

    return jobIndex
}

/**
 * @param {RunArtifactInput} input
 * @returns {GitHubRunArtifact}
 */
export function buildRunArtifact(input) {
    return {
        schema_version: 1,
        agent: withJobIndex(input.agent, input.jobIndex),
        profile: input.profile,
        stopped: input.stopped,
    }
}

/**
 * Names the artifact. Only the prefix is parsed downstream, so the rest
 * exists to keep the name unique within the run; a collision costs a leg its
 * whole envelope, because the upload fails outright.
 *
 * `uniqueSuffix` carries that uniqueness on its own. The leg index cannot:
 * jibril does not always record it, and GITHUB_JOB is identical across every
 * leg of a matrix. It is still included when known, because a readable name
 * is worth more than a tidy rule.
 * @param {RunArtifactNameInput} input
 * @returns {string}
 */
export function resolveRunArtifactName(input) {
    const parts = [toNameSlug(input.job), input.jobIndex === null ? "" : String(input.jobIndex), input.uniqueSuffix]

    return ARTIFACT_NAME_PREFIX + parts.filter(part => part !== "").join("-")
}

/**
 * An oversized envelope is discarded server-side with no comment at all, so
 * dropping the profile and reporting the job as unreadable beats sending
 * something that renders nothing.
 * @param {GitHubRunArtifact} envelope
 * @returns {SerializedRunArtifact}
 */
export function serializeRunArtifact(envelope) {
    const content = JSON.stringify(envelope)
    const size = Buffer.byteLength(content, "utf8")
    if (size <= MAX_ARTIFACT_BYTES) {
        return { content, profileOmitted: false }
    }

    /** @type {GitHubRunArtifact} */
    const withoutProfile = {
        schema_version: 1,
        agent: envelope.agent,
        profile: null,
        stopped: withProfileOmitted(envelope.stopped, size),
    }

    return { content: JSON.stringify(withoutProfile), profileOmitted: true }
}

/**
 * Best-effort: the job is never failed over a relay upload, but every
 * failure is a warning, because it is the whole reason no Runtime Review
 * appears on the pull request.
 * @param {string} name
 * @param {GitHubRunArtifact} envelope
 * @returns {Promise<void>}
 */
export async function uploadRunArtifact(name, envelope) {
    const serialized = serializeRunArtifact(envelope)
    if (serialized.profileOmitted) {
        core.warning(
            "The Execution Profile for this job is too large to relay through a workflow artifact and was " +
                "dropped from the upload. The Runtime Review will report this job as unrecorded.",
        )
    }

    // mkdtemp, not a predictable path: a fixed /tmp name is a
    // symlink-overwrite target.
    /** @type {string} */
    let stagingDir
    try {
        stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), "garnet-run-"))
    } catch (error) {
        core.warning(`Failed to stage the Garnet run artifact: ${getErrorMessage(error)}`)
        return
    }

    try {
        const entryPath = path.join(stagingDir, ARTIFACT_ENTRY_PATH)
        await fs.mkdir(path.dirname(entryPath), { recursive: true })
        await fs.writeFile(entryPath, serialized.content)

        await artifactClient.uploadArtifact(name, [entryPath], stagingDir)
        core.info(`Uploaded the Garnet run artifact '${name}'`)
    } catch (error) {
        core.warning(
            `Failed to upload the Garnet run artifact '${name}': ${getErrorMessage(error)}. ` +
                "No Runtime Review will be published for this job.",
        )
    } finally {
        await fs.rm(stagingDir, { recursive: true, force: true })
    }
}

/**
 * The main step builds the agent body before jibril runs, so the leg index
 * can only be filled in here. An unknown index is left out rather than
 * guessed: the control plane treats 0 as a real leg.
 * @param {CreateAgentRequest} agent
 * @param {number | null} jobIndex
 * @returns {CreateAgentRequest}
 */
function withJobIndex(agent, jobIndex) {
    if (agent.github_context === undefined || jobIndex === null) {
        return agent
    }

    return {
        ...agent,
        github_context: { ...agent.github_context, job_index: jobIndex },
    }
}

/**
 * @param {AgentStoppedRequest} stopped
 * @param {number} size
 * @returns {AgentStoppedRequest}
 */
function withProfileOmitted(stopped, size) {
    const omitted = `profile omitted: ${size} bytes exceeds the ${MAX_ARTIFACT_BYTES} byte run artifact budget`

    return {
        ...stopped,
        profileState: "invalid",
        detail: stopped.detail === undefined ? omitted : `${stopped.detail}; ${omitted}`,
    }
}

/**
 * @param {string} value
 * @returns {string}
 */
function toNameSlug(value) {
    return value
        .replace(/[^A-Za-z0-9_-]+/g, "-")
        .slice(0, MAX_JOB_NAME_LENGTH)
        .replace(/^-+|-+$/g, "")
}
