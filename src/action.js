// This script installs jibril, calls the control-plane API to create the
// agent and fetch network policy, and sets up Jibril as a systemd service.

import * as core from "@actions/core"
import * as exec from "@actions/exec"
import { HttpClient } from "@actions/http-client"
import { createHash } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { pipeline } from "node:stream/promises"
import { createGitHubContext, getProfileJobName, getWorkflowFilePath } from "./github-context.js"
import { resolveForkSkip } from "./fork-run.js"
import { ControlPlaneClient } from "./control-plane/client.js"
import { getEnv, getErrorMessage, isSupportedArch, isSupportedPlatform, pathExists, waitForDelay } from "./shared.js"
import { getGitHubIDToken, isMissingOIDCPermissionError, resolveOIDCAudience } from "./oidc.js"

/**
 * @typedef {import("@actions/exec").ExecOptions} ExecOptions
 */

/**
 * @typedef {{ stdout: string, stderr: string }} ExecCaptureResult
 */

const INSTPATH = "/usr/local/bin"
// Default Jibril sensor version: the same stable pin as the floating v2 tag,
// so the sensor never floats under an unchanged action ref.
const JIBRIL_STABLE_VERSION = "v2.16.0"
// From v2.17.0 on a release ships one linux-x86_64 tarball carrying the binary
// next to its checksums, a release manifest, and a detached Sigstore bundle for
// each of those payloads. Older releases only offer the bare `jibril` asset.
const JIBRIL_RELEASES_REPO = "garnet-org/jibril-releases"
const JIBRIL_RELEASES_URL = `https://github.com/${JIBRIL_RELEASES_REPO}/releases`
// The release workflow signs its own attestation over the bundle payloads.
// `gh attestation verify` filters on SLSA provenance by default, which this
// release process does not publish, so the predicate type is passed explicitly.
// Update both if the jibril release workflow ever changes them.
const JIBRIL_ATTESTATION_PREDICATE = `https://github.com/${JIBRIL_RELEASES_REPO}/attestations/release/v1`
const JIBRIL_SIGNER_WORKFLOW = `${JIBRIL_RELEASES_REPO}/.github/workflows/jibril-public-release.yml`
/** @type {JibrilCoreVersion} */
const JIBRIL_BUNDLE_MIN_VERSION = { major: 2, minor: 17, patch: 0 }
const JIBRIL_BINARY = "jibril"
const JIBRIL_CHECKSUMS = "jibril-checksums.txt"
const JIBRIL_MANIFEST = "release.json"
const SIGSTORE_SUFFIX = ".sigstore.json"
// Stop ceiling for the jibril unit. On stop the daemon flushes its whole
// event backlog and writes the JSON profile only when the flush completes;
// the binary's stock TimeoutStopSec=600 has been observed SIGKILLing the
// flush mid-way on ~60-minute jobs, losing the profile. The drop-in raises
// the ceiling so heavy flushes complete; the post step reads the effective
// value live and bounds its own wait to it.
const JIBRIL_STOP_TIMEOUT_ENV = "GARNET_JIBRIL_STOP_TIMEOUT_SECONDS"
const DEFAULT_JIBRIL_STOP_TIMEOUT_SECONDS = 1800

// This function is the main entry point for the script.
// Returns true when Jibril started successfully, false otherwise.
export async function run() {
    let tmpDir = ""
    try {
        // Get the variables from the environment.
        const TOKEN = getEnv("GARNET_API_TOKEN")
        const API = validateApiURL(getEnv("GARNET_API_URL", "https://api.garnet.ai"))
        let JIBRILVER = resolveJibrilVersion(getEnv("JIBRIL_VERSION", ""), getEnv("GITHUB_ACTION_REF", ""))
        const DEBUG = getEnv("DEBUG", "false")

        if (TOKEN === "") {
            const forkSkip = await resolveForkSkip({
                eventName: getEnv("GITHUB_EVENT_NAME"),
                eventPath: getEnv("GITHUB_EVENT_PATH"),
                repository: getEnv("GITHUB_REPOSITORY"),
            })
            if (forkSkip.skip) {
                core.info(forkSkip.reason)
                return false
            }
        }

        const controlPlaneAuth = await resolveControlPlaneAuth({
            apiURL: API,
            apiToken: TOKEN,
        })

        // Prevent accidental leakage of tokens in logs.
        if (TOKEN !== "") {
            core.setSecret(TOKEN)
        }
        if (controlPlaneAuth.workflowToken !== "") {
            core.setSecret(controlPlaneAuth.workflowToken)
        }
        const GITHUB_TOKEN = getEnv("GITHUB_TOKEN", "")
        if (GITHUB_TOKEN !== "") {
            core.setSecret(GITHUB_TOKEN)
        }
        const AI_TOKEN = getEnv("AI_TOKEN", "")
        if (AI_TOKEN !== "") {
            core.setSecret(AI_TOKEN)
        }

        const workspace = getEnv("GITHUB_WORKSPACE")
        if (!workspace) {
            core.warning("GITHUB_WORKSPACE is not set. Jibril workflow-file resolution may be limited.")
        } else if (!(await pathExists(path.join(workspace, ".git")))) {
            core.warning(
                "Repository checkout not detected. Jibril will rely on the GitHub API to fetch the running workflow file; " +
                    "if that fails, add 'actions/checkout@v6' before this action as a fallback.",
            )
        }

        const platform = os.platform()
        if (!isSupportedPlatform(platform)) {
            core.warning(`Garnet runtime monitoring requires Linux (eBPF-based). Skipping on ${platform}.`)
            return false
        }

        const arch = os.arch()
        if (!isSupportedArch(arch)) {
            core.warning(
                `Garnet runtime monitoring requires x86_64 (jibril is only available for amd64). Skipping on ${arch}.`,
            )
            return false
        }

        if (JIBRILVER !== "latest" && !JIBRILVER.startsWith("v")) {
            JIBRILVER = `v${JIBRILVER}`
        }
        validateJibrilVersion(JIBRILVER)

        // The bundled tarball's filename embeds the tag, and the agent record
        // should name the exact sensor that ran.
        if (JIBRILVER === "latest") {
            JIBRILVER = await resolveLatestJibrilTag()
        }

        core.info(`API server: ${API}`)
        core.info(`Jibril Version: ${JIBRILVER}`)

        // Create a temporary directory for the script to use.
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "garnet-"))

        const jibrilDest = await downloadJibril(JIBRILVER, tmpDir)
        if (!(await pathExists(jibrilDest))) {
            throw new Error("Failed to download jibril binary")
        }
        await execSudo(["mv", jibrilDest, `${INSTPATH}/jibril`])
        await execSudo(["chmod", "+x", `${INSTPATH}/jibril`])

        // Create github context.
        core.info("Creating github context")
        const githubContext = /** @type {import("./control-plane/types.js").AgentGithubContext} */ (
            await createGitHubContext()
        )

        // Resolve runtime values for agent creation.
        const VERSION = JIBRILVER
        const RUNNER_IP = getFirstIpv4() || "127.0.0.1"

        let SYSTEM_MACHINE_ID = os.hostname()
        const machineIDPaths = ["/etc/machine-id", "/var/lib/dbus/machine-id"]
        for (const p of machineIDPaths) {
            if (await pathExists(p)) {
                SYSTEM_MACHINE_ID = (await fs.readFile(p, "utf8")).trim()
                break
            }
        }

        const MACHINE_ID = SYSTEM_MACHINE_ID
        const profileJob = getProfileJobName()
        const HOSTNAME = `${os.hostname()}-${getEnv("GITHUB_RUN_ID")}-${profileJob}`
        const AGENT_OS = normalizeAgentOs(os.platform())
        const AGENT_ARCH = normalizeAgentArch(os.arch())

        // Internal test toggle: when true, we ask the control-plane to skip posting
        // the profile GitHub App comment for this run.
        const skipProfileGitHubComment = getEnv("GARNET_ACTION_SKIP_GITHUB_APP_COMMENT", "false") === "true"

        const controlPlaneClient = new ControlPlaneClient({
            baseURL: API,
            projectToken: controlPlaneAuth.projectToken,
            workflowToken: controlPlaneAuth.workflowToken,
        })

        // Create agent.
        core.info("Creating github agent")

        let AGENT_ID = ""
        let AGENT_TOKEN = ""
        try {
            /** @type {import("./control-plane/types.js").CreateAgentRequest} */
            const createAgentInput = {
                os: AGENT_OS,
                arch: AGENT_ARCH,
                hostname: HOSTNAME,
                version: VERSION,
                ip: RUNNER_IP,
                machine_id: MACHINE_ID,
                kind: "github",
                github_context: githubContext,
            }

            if (skipProfileGitHubComment) {
                createAgentInput.labels = {
                    "garnet.ai/skipProfileGitHubComment": "true",
                }
            }

            const createdAgent = await controlPlaneClient.createAgent(createAgentInput)
            AGENT_ID = createdAgent.id
            AGENT_TOKEN = createdAgent.agent_token
        } catch (error) {
            throw new Error(`Failed to create agent: ${getErrorMessage(error)}`)
        }

        if (AGENT_TOKEN) core.setSecret(AGENT_TOKEN)

        core.info(`Created agent with ID: ${AGENT_ID}`)

        // The post step resolves the run's profile envelope ID from this agent.
        core.saveState("agentID", AGENT_ID)

        // The post step authenticates as this agent to report stop reasons.
        core.saveState("agentToken", AGENT_TOKEN)

        // Get network policy
        core.info("Getting network policy")

        const REPO_ID = getEnv("GITHUB_REPOSITORY")
        const WORKFLOW = getEnv("GITHUB_WORKFLOW")

        // Create the network policy path.
        const NETPOLICY_PATH = path.join(tmpDir, "netpolicy.yaml")

        core.info(`Fetching network policy for ${REPO_ID}/${WORKFLOW}...`)

        // Fetch and save the network policy.
        try {
            const networkPolicyYaml = await controlPlaneClient.mergedNetPoliciesAsYAML({
                repository_id: REPO_ID,
                workflow_name: WORKFLOW,
            })

            validateNetworkPolicyYAML(networkPolicyYaml)
            await fs.writeFile(NETPOLICY_PATH, networkPolicyYaml)
        } catch (error) {
            throw new Error(`Failed to fetch network policy: ${getErrorMessage(error)}`)
        }

        if (!(await pathExists(NETPOLICY_PATH))) {
            throw new Error("Network policy file was not created")
        }

        // Save the network policy to the file system.
        core.info(`Network policy saved to ${NETPOLICY_PATH}`)
        if (DEBUG === "true") {
            const content = await fs.readFile(NETPOLICY_PATH, "utf8")
            core.info(content.split("\n").slice(0, 20).join("\n"))
        }

        core.info("Installing obtained network policy to /etc/jibril/netpolicy.yaml")

        // Set the environment variables for Jibril.
        process.env.GARNET_API_URL = API
        process.env.GARNET_API_TOKEN = TOKEN
        process.env.GARNET_AGENT_TOKEN = AGENT_TOKEN
        process.env.GITHUB_WORKFLOW_FILE = getWorkflowFilePath()

        // Create Jibril default environment file
        core.info("Creating Jibril default environment file")

        const jibrilDefault = `# Garnet API configuration
GARNET_API_URL=${process.env.GARNET_API_URL}
GARNET_API_TOKEN=${process.env.GARNET_API_TOKEN}
GARNET_AGENT_TOKEN=${process.env.GARNET_AGENT_TOKEN}
GARNET_SAR=${getEnv("GARNET_SAR", "true")}
# AI configuration
AI_ENABLED=${getEnv("AI_ENABLED", "false")}
AI_MODE=${getEnv("AI_MODE", "reason")}
AI_TOKEN=${getEnv("AI_TOKEN")}
AI_MODEL=${getEnv("AI_MODEL", "gpt-4o")}
AI_TEMPERATURE=${getEnv("AI_TEMPERATURE", "0.3")}
# Runner information
RUNNER_ARCH=${getEnv("RUNNER_ARCH")}
RUNNER_OS=${getEnv("RUNNER_OS")}
# Jibril writes profile outputs to these files
JIBRIL_PROFILER_FILE=${getEnv("JIBRIL_PROFILER_FILE")}
JIBRIL_JSONPROFILER_FILE=${getEnv("JIBRIL_JSONPROFILER_FILE")}
# GitHub context
GITHUB_ACTION=${getEnv("GITHUB_ACTION", "__run")}
GITHUB_ACTOR_ID=${getEnv("GITHUB_ACTOR_ID")}
GITHUB_ACTOR=${getEnv("GITHUB_ACTOR")}
GITHUB_EVENT_NAME=${getEnv("GITHUB_EVENT_NAME")}
GITHUB_JOB=${getEnv("GITHUB_JOB")}
GITHUB_REF_NAME=${getEnv("GITHUB_REF_NAME")}
GITHUB_REF_PROTECTED=${getEnv("GITHUB_REF_PROTECTED")}
GITHUB_REF_TYPE=${getEnv("GITHUB_REF_TYPE")}
GITHUB_REF=${getEnv("GITHUB_REF")}
GITHUB_REPOSITORY_ID=${getEnv("GITHUB_REPOSITORY_ID")}
GITHUB_REPOSITORY_OWNER_ID=${getEnv("GITHUB_REPOSITORY_OWNER_ID")}
GITHUB_REPOSITORY_OWNER=${getEnv("GITHUB_REPOSITORY_OWNER")}
GITHUB_REPOSITORY=${getEnv("GITHUB_REPOSITORY")}
GITHUB_RUN_ATTEMPT=${getEnv("GITHUB_RUN_ATTEMPT")}
GITHUB_RUN_ID=${getEnv("GITHUB_RUN_ID")}
GITHUB_RUN_NUMBER=${getEnv("GITHUB_RUN_NUMBER")}
GITHUB_SERVER_URL=${getEnv("GITHUB_SERVER_URL")}
GITHUB_SHA=${getEnv("GITHUB_SHA")}
GITHUB_STEP_SUMMARY=${getEnv("GITHUB_STEP_SUMMARY")}
GITHUB_TOKEN=${getEnv("GITHUB_TOKEN")}
GITHUB_TRIGGERING_ACTOR=${getEnv("GITHUB_TRIGGERING_ACTOR")}
GITHUB_WORKFLOW_REF=${getEnv("GITHUB_WORKFLOW_REF")}
GITHUB_WORKFLOW_SHA=${getEnv("GITHUB_WORKFLOW_SHA")}
GITHUB_WORKFLOW=${getEnv("GITHUB_WORKFLOW")}
GITHUB_WORKFLOW_FILE=${getEnv("GITHUB_WORKFLOW_FILE")}
GITHUB_WORKSPACE=${getEnv("GITHUB_WORKSPACE")}
`

        const jibrilDefaultPath = path.join(tmpDir, "jibril.default")
        await fs.writeFile(jibrilDefaultPath, jibrilDefault)

        core.info("Installing default environment file to /etc/default/jibril")
        await execSudo(["install", "-D", "-o", "root", "-m", "600", jibrilDefaultPath, "/etc/default/jibril"])

        // Verify default environment file (redacted for security).
        if (DEBUG === "true") {
            try {
                const defaultContent = await readFileSafe("/etc/default/jibril")
                core.info("Default environment file:")
                core.info(redactSensitive(defaultContent) ?? "No default environment file found")
            } catch (_) {}
        }

        core.info("Installing Jibril as a systemd service")
        await execSudo([`${INSTPATH}/jibril`, "--systemd", "install"])

        // Configure logging using a systemd drop-in override
        core.info("Configuring Jibril logging")
        await execSudo(["mkdir", "-p", "/etc/systemd/system/jibril.service.d"])
        const loggingConf = `[Service]
StandardError=append:/var/log/jibril.err
StandardOutput=append:/var/log/jibril.log
`

        // Configure logging using a systemd drop-in override.
        const loggingConfPath = path.join(tmpDir, "logging.conf")
        await fs.writeFile(loggingConfPath, loggingConf)
        await execSudo(["cp", loggingConfPath, "/etc/systemd/system/jibril.service.d/logging.conf"])

        // Raise the unit's stop ceiling so the shutdown event flush can
        // complete and the JSON profile gets written on heavy jobs. A
        // disabled bound is written as `infinity` rather than `0`: systemd
        // only reads `0` as "no timeout" through a legacy compatibility
        // path, and `0s` meant an immediate SIGKILL on some versions.
        const stopTimeoutSeconds = resolveStopTimeoutSeconds(getEnv(JIBRIL_STOP_TIMEOUT_ENV, ""))
        const stopTimeoutValue = stopTimeoutSeconds > 0 ? String(stopTimeoutSeconds) : "infinity"
        core.info(`Configuring Jibril stop timeout (${stopTimeoutValue})`)
        const stopTimeoutConf = `[Service]
TimeoutStopSec=${stopTimeoutValue}
`
        const stopTimeoutConfPath = path.join(tmpDir, "stop-timeout.conf")
        await fs.writeFile(stopTimeoutConfPath, stopTimeoutConf)
        await execSudo(["cp", stopTimeoutConfPath, "/etc/systemd/system/jibril.service.d/stop-timeout.conf"])

        // Verify installed files.
        if (DEBUG === "true") {
            try {
                const entries = await readdirRecursiveSafe("/etc/jibril")
                core.info("Jibril installed files:")
                core.info(entries.length > 0 ? entries.join("\n") : "No files found in /etc/jibril/")
            } catch (_) {}
            try {
                const configOutput = await readFileSafe("/etc/jibril/config.yaml")
                core.info("Jibril configuration:")
                core.info(configOutput || "No configuration file found")
            } catch (_) {}
            try {
                const policyContent = await readFileSafe("/etc/jibril/netpolicy.yaml")
                core.info("Jibril default network policy:")
                core.info(
                    policyContent ? policyContent.split("\n").slice(0, 20).join("\n") : "No network policy file found",
                )
            } catch (_) {}
        }

        // Replace network policy with fetched one.
        await execSudo(["cp", "-v", NETPOLICY_PATH, "/etc/jibril/netpolicy.yaml"])

        // Verify replaced network policy.
        if (DEBUG === "true") {
            try {
                const replacedContent = await readFileSafe("/etc/jibril/netpolicy.yaml")
                core.info("Replaced Jibril network policy:")
                core.info(
                    replacedContent
                        ? replacedContent.split("\n").slice(0, 20).join("\n")
                        : "No network policy file found",
                )
            } catch (_) {}
        }

        if (DEBUG === "true") {
            core.info("Reloading systemd and enabling Jibril service...")
        }

        // Reload systemd and enable Jibril service.
        await execSudo(["systemctl", "daemon-reload"])
        await execSudo(["systemctl", "enable", "jibril.service"], {
            ignoreReturnCode: true,
        })

        if (DEBUG === "true") {
            core.info("Starting Jibril service...")
        }

        // Start Jibril service, but do not fail the workflow if the daemon crashes.
        const returnCode = await execSudo(["systemctl", "start", "jibril.service"], {
            ignoreReturnCode: true,
        })

        if (returnCode !== 0) {
            core.warning(
                "Jibril service failed to start. The workflow will continue without runtime monitoring for this run.",
            )
            await dumpJibrilLogs()
            return false
        }

        // Give the daemon a moment to settle so an immediate crash is surfaced here.
        await waitForDelay(5000)

        const { stdout: serviceState } = await execCapture("sudo", ["systemctl", "is-active", "jibril.service"], {
            ignoreReturnCode: true,
        })

        if (serviceState !== "active") {
            core.warning(
                `Jibril service exited early with state '${serviceState || "unknown"}'. The workflow will continue without runtime monitoring for this run.`,
            )
            await dumpJibrilLogs()
            return false
        }

        // Check Jibril service status.
        if (DEBUG === "true") {
            core.info("Checking Jibril service status...")
            await execSudo(["systemctl", "status", "jibril.service", "--no-pager"], {
                ignoreReturnCode: true,
            })

            core.info("Jibril systemd unit (systemctl cat):")
            try {
                const { stdout, stderr } = await execCapture("sudo", ["systemctl", "cat", "jibril.service"], {
                    ignoreReturnCode: true,
                })
                core.info(formatCapturedOutput(stdout, "(empty stdout)"))
                if (stderr !== "") {
                    core.info("systemctl cat stderr:")
                    core.info(formatCapturedOutput(stderr, "(empty stderr)"))
                }
            } catch (_) {
                core.info("(systemctl cat failed)")
            }
        }

        core.info("Jibril service started successfully")
        return true
    } catch (err) {
        core.warning(
            `Garnet runtime monitoring setup did not complete: ${getErrorMessage(err)}. The workflow will continue without runtime monitoring for this run.`,
        )
        await dumpJibrilLogs()
        return false
    } finally {
        // Clean up the temporary directory.
        if (tmpDir !== "") {
            await fs.rm(tmpDir, { recursive: true, force: true })
        }
    }
}

/**
 * @typedef {{
 *   apiURL: string
 *   apiToken: string
 * }} ResolveControlPlaneAuthInput
 */

/**
 * @typedef {{
 *   projectToken: string
 *   workflowToken: string
 *   workflowTokenExpiresAt: string
 * }} ControlPlaneAuth
 */

/**
 * @param {ResolveControlPlaneAuthInput} input
 * @returns {Promise<ControlPlaneAuth>}
 */
export async function resolveControlPlaneAuth(input) {
    const audience = resolveOIDCAudience(input.apiURL)

    const unauthenticatedControlPlaneClient = new ControlPlaneClient({
        baseURL: input.apiURL,
    })

    let exchanged
    try {
        const idToken = await getGitHubIDToken(audience)
        exchanged = await unauthenticatedControlPlaneClient.exchangeGitHubOIDCForWorkflowToken(idToken)
    } catch (error) {
        const errorMessage = getErrorMessage(error)
        if (isMissingOIDCPermissionError(errorMessage)) {
            core.warning(
                "github: OIDC token request failed because this workflow is missing 'id-token: write' permission. Falling back to 'api_token'.",
            )
        } else if (errorMessage.startsWith("OIDC token request failed")) {
            core.warning(`github: ${errorMessage}. Falling back to 'api_token'.`)
        } else {
            core.warning(`OIDC exchange failed (${errorMessage}). Falling back to 'api_token'.`)
        }

        return {
            projectToken: requireApiToken(input.apiToken),
            workflowToken: "",
            workflowTokenExpiresAt: "",
        }
    }

    if (isTimestampExpired(exchanged.expiresAt)) {
        core.warning("OIDC workflow token was already expired at issuance time. Retrying once.")

        try {
            const idToken = await getGitHubIDToken(audience)
            exchanged = await unauthenticatedControlPlaneClient.exchangeGitHubOIDCForWorkflowToken(idToken)
        } catch (error) {
            const errorMessage = getErrorMessage(error)
            if (errorMessage.startsWith("OIDC token request failed")) {
                core.warning(`github: ${errorMessage}. Falling back to 'api_token'.`)
            } else {
                core.warning(`OIDC exchange retry failed (${errorMessage}). Falling back to 'api_token'.`)
            }
            return {
                projectToken: requireApiToken(input.apiToken),
                workflowToken: "",
                workflowTokenExpiresAt: "",
            }
        }

        if (isTimestampExpired(exchanged.expiresAt)) {
            core.warning("OIDC workflow token remains expired after retry. Falling back to 'api_token'.")
            return {
                projectToken: requireApiToken(input.apiToken),
                workflowToken: "",
                workflowTokenExpiresAt: "",
            }
        }
    }

    core.info("Using OIDC workflow token for control-plane requests")

    return {
        projectToken: "",
        workflowToken: exchanged.workflowToken,
        workflowTokenExpiresAt: exchanged.expiresAt,
    }
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isTimestampExpired(value) {
    if (value === "") {
        return true
    }

    const expiresAtMs = Date.parse(value)
    if (Number.isNaN(expiresAtMs)) {
        return true
    }

    return expiresAtMs <= Date.now()
}

/**
 * @param {string} token
 * @returns {string}
 */
function requireApiToken(token) {
    if (token !== "") {
        return token
    }

    throw new Error(
        "Input 'api_token' is required when OIDC authentication is unavailable. This commonly happens on pull requests from forks, where repository secrets are not exposed to workflows, or when 'id-token: write' permission is not granted. Add/verify that your workflow passes a valid token to this input, grant 'id-token: write', or conditionally skip this action for forked PRs.",
    )
}

// Accepted jibril_version shapes: `latest` or a release tag such as v0.0,
// v2.16.0, 2.16.0, or v2.17.0-rc.1. Anything else is rejected before the
// value reaches the release download URL.
const JIBRIL_VERSION_PATTERN = /^v?\d+\.\d+(\.\d+)?(-[A-Za-z0-9.]+)?$/

/**
 * Rejects jibril_version values that do not name a release: the version is
 * interpolated into the release download URL, so a free-form value could
 * point the root-executed binary at an arbitrary URL path.
 * @param {string} version
 * @returns {string}
 */
export function validateJibrilVersion(version) {
    if (version === "latest" || JIBRIL_VERSION_PATTERN.test(version)) {
        return version
    }

    throw new Error(
        `Invalid jibril_version '${version}': expected 'latest' or a release version such as 'v2.16.0'.`,
    )
}

/**
 * Requires the API URL to be https (http is allowed for localhost only), so
 * tokens are never sent in cleartext to a remote host.
 * @param {string} value
 * @returns {string}
 */
export function validateApiURL(value) {
    let parsed
    try {
        parsed = new URL(value)
    } catch (_) {
        throw new Error(`Invalid api_url '${value}': not a valid URL.`)
    }

    if (parsed.protocol === "https:") {
        return value
    }

    const isLoopbackHost =
        parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1"
    if (parsed.protocol === "http:" && isLoopbackHost) {
        return value
    }

    throw new Error(`Invalid api_url '${value}': must use https (http is allowed for localhost only).`)
}

const NETPOLICY_MAX_BYTES = 1024 * 1024

/**
 * Sanity-checks the network policy fetched from the control plane before it
 * is written under /etc/jibril: it must be non-empty printable YAML text of
 * bounded size.
 * @param {string} content
 * @returns {string}
 */
export function validateNetworkPolicyYAML(content) {
    if (typeof content !== "string" || content.trim() === "") {
        throw new Error("Network policy from the control plane is empty.")
    }

    if (Buffer.byteLength(content, "utf8") > NETPOLICY_MAX_BYTES) {
        throw new Error("Network policy from the control plane exceeds the 1 MiB size bound.")
    }

    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(content)) {
        throw new Error("Network policy from the control plane contains control characters.")
    }

    return content
}

/**
 * @param {string} inputVersion
 * @param {string} actionRef
 */
export function resolveJibrilVersion(inputVersion, actionRef) {
    const v = String(inputVersion || "").trim()
    if (v) return v

    const ref = String(actionRef || "")
        .trim()
        .replace(/^refs\/tags\//, "")
    // Keep tag behavior stable:
    // - action@v0 -> daily builds (v0.0)
    // - action@v2 -> stable release (pinned)
    // - action@v1 stays pinned (do not change)
    if (ref === "v0") return "v0.0"
    if (ref === "v1") return "v2.10.4"
    if (ref === "v2") return JIBRIL_STABLE_VERSION

    // Every other ref (branch/SHA/exact tag) gets the same stable pin as v2:
    // a root eBPF binary must not change under an unchanged action ref.
    return JIBRIL_STABLE_VERSION
}

/**
 * @typedef {Object} JibrilCoreVersion
 * @prop {number} major
 * @prop {number} minor
 * @prop {number} patch
 */

/**
 * Prereleases sort with their core version, so v2.17.0-rc.5 is bundled too.
 * Non-semver tags (daily builds) keep the bare binary.
 * @param {string} tag
 * @returns {boolean}
 */
export function usesBundledJibrilRelease(tag) {
    const version = parseCoreVersion(tag)
    if (version === null) return false

    const { major, minor, patch } = JIBRIL_BUNDLE_MIN_VERSION
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

/**
 * GitHub redirects /releases/latest to the tag page, so the tag comes from the
 * Location header with no body download.
 * @returns {Promise<string>}
 */
async function resolveLatestJibrilTag() {
    const client = new HttpClient("garnet-action", undefined, { allowRedirects: false })
    const response = await client.head(`${JIBRIL_RELEASES_URL}/latest`)
    response.message.resume()

    const location = response.message.headers.location ?? ""
    const match = /\/releases\/tag\/([\w.+-]+)$/.exec(location)
    if (match === null) {
        const statusCode = response.message.statusCode ?? 0
        throw new Error(`Failed to resolve the latest jibril release tag (HTTP ${statusCode})`)
    }

    const [, tag = ""] = match
    core.info(`Resolved jibril 'latest' to ${tag}`)
    return tag
}

/**
 * Returns the path of the verified binary. `tag` is always concrete: "latest"
 * is resolved before this is called.
 * @param {string} tag
 * @param {string} tmpDir
 * @returns {Promise<string>}
 */
async function downloadJibril(tag, tmpDir) {
    const releaseURL = `${JIBRIL_RELEASES_URL}/download/${tag}`
    const binaryPath = path.join(tmpDir, JIBRIL_BINARY)

    if (!usesBundledJibrilRelease(tag)) {
        const binaryURL = `${releaseURL}/${JIBRIL_BINARY}`
        core.info(`Downloading jibril: ${binaryURL}`)
        await downloadFile(binaryURL, binaryPath)
        return binaryPath
    }

    const archiveName = `jibril-${tag}-linux-x86_64.tar.gz`
    const archiveURL = `${releaseURL}/${archiveName}`
    const archivePath = path.join(tmpDir, archiveName)
    const bundleDir = path.join(tmpDir, "bundle")

    core.info(`Downloading jibril: ${archiveURL}`)
    await downloadFile(archiveURL, archivePath)

    await fs.mkdir(bundleDir, { recursive: true })
    await exec.exec("tar", ["-xzf", archivePath, "-C", bundleDir])
    await verifyJibrilBundle(bundleDir, tag)
    await verifyJibrilAttestation(path.join(bundleDir, JIBRIL_BINARY))
    await fs.rename(path.join(bundleDir, JIBRIL_BINARY), binaryPath)

    return binaryPath
}

/**
 * Proves the bundle is self-consistent and belongs to `tag`. Authenticity is
 * verifyJibrilAttestation's job.
 * @param {string} bundleDir
 * @param {string} tag
 * @returns {Promise<void>}
 */
export async function verifyJibrilBundle(bundleDir, tag) {
    const binaryDigest = await verifySignedPayload(bundleDir, JIBRIL_BINARY)
    const checksumsDigest = await verifySignedPayload(bundleDir, JIBRIL_CHECKSUMS)
    await verifySignedPayload(bundleDir, JIBRIL_MANIFEST)

    const checksums = parseChecksums(await fs.readFile(path.join(bundleDir, JIBRIL_CHECKSUMS), "utf8"))
    assertSha256(JIBRIL_BINARY, binaryDigest, checksums.get(JIBRIL_BINARY), JIBRIL_CHECKSUMS)

    const manifest = parseReleaseManifest(await fs.readFile(path.join(bundleDir, JIBRIL_MANIFEST), "utf8"))
    if (manifest.tag !== tag) {
        throw new Error(`jibril release bundle is for ${manifest.tag}, expected ${tag}`)
    }
    assertSha256(JIBRIL_BINARY, binaryDigest, manifest.subjects.get(JIBRIL_BINARY), JIBRIL_MANIFEST)
    assertSha256(JIBRIL_CHECKSUMS, checksumsDigest, manifest.subjects.get(JIBRIL_CHECKSUMS), JIBRIL_MANIFEST)

    core.info(`Verified the jibril bundle digests for ${tag}`)
}

/**
 * Checks a payload against the digest its detached Sigstore bundle signed, and
 * returns that digest.
 * @param {string} bundleDir
 * @param {string} name
 * @returns {Promise<string>}
 */
async function verifySignedPayload(bundleDir, name) {
    const signatureName = `${name}${SIGSTORE_SUFFIX}`
    const payloadPath = path.join(bundleDir, name)
    const signaturePath = path.join(bundleDir, signatureName)

    for (const filePath of [payloadPath, signaturePath]) {
        if (!(await pathExists(filePath))) {
            throw new Error(`jibril release bundle is missing ${path.basename(filePath)}`)
        }
    }

    const digest = await fileSha256(payloadPath)
    const signedDigest = readSignedDigest(await fs.readFile(signaturePath, "utf8"))
    assertSha256(name, digest, signedDigest, signatureName)

    return digest
}

/**
 * Establishes authenticity: `gh` checks the Sigstore signature, that the signer
 * is the jibril release workflow, and transparency-log inclusion. It is
 * preinstalled on GitHub-hosted runners and reads GITHUB_TOKEN from the
 * environment; when either is absent we warn rather than fail so self-hosted
 * runners keep working.
 * @param {string} binaryPath
 * @returns {Promise<void>}
 */
async function verifyJibrilAttestation(binaryPath) {
    if (getEnv("GITHUB_TOKEN", "") === "") {
        core.warning("github_token is unset: skipping jibril attestation verification.")
        return
    }

    if (!(await isCommandAvailable("gh"))) {
        core.warning("gh CLI is unavailable: skipping jibril attestation verification.")
        return
    }

    const args = [
        "attestation",
        "verify",
        binaryPath,
        "--repo",
        JIBRIL_RELEASES_REPO,
        "--predicate-type",
        JIBRIL_ATTESTATION_PREDICATE,
        "--signer-workflow",
        JIBRIL_SIGNER_WORKFLOW,
    ]
    const exitCode = await exec.exec("gh", args, { ignoreReturnCode: true })
    if (exitCode !== 0) {
        throw new Error(`Attestation verification failed for ${JIBRIL_BINARY}: gh exited ${exitCode}`)
    }

    core.info(`Verified the jibril attestation signed by ${JIBRIL_SIGNER_WORKFLOW}`)
}

/**
 * @param {string} command
 * @returns {Promise<boolean>}
 */
async function isCommandAvailable(command) {
    try {
        const exitCode = await exec.exec(command, ["--version"], { ignoreReturnCode: true, silent: true })
        return exitCode === 0
    } catch (_) {
        return false
    }
}

/**
 * @param {string} name
 * @param {string} actual
 * @param {string|undefined} expected  absent when `source` never recorded it
 * @param {string} source
 * @returns {void}
 */
function assertSha256(name, actual, expected, source) {
    if (expected === undefined) {
        throw new Error(`${source} records no sha256 for ${name}`)
    }
    if (expected !== actual) {
        throw new Error(`sha256 mismatch for ${name}: ${source} expects ${expected}, got ${actual}`)
    }
}

/**
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function fileSha256(filePath) {
    const hash = createHash("sha256")
    await pipeline(createReadStream(filePath), hash)
    return hash.digest("hex")
}

/**
 * Reads `<sha256>  <filename>` lines into digests keyed by filename.
 * @param {string} checksumsText
 * @returns {Map<string, string>}
 */
function parseChecksums(checksumsText) {
    /** @type {Map<string, string>} */
    const digests = new Map()
    for (const line of checksumsText.split("\n")) {
        const match = /^([a-f0-9]{64})\s+\*?(\S+)$/i.exec(line.trim())
        if (match === null) continue

        const [, digest = "", name = ""] = match
        digests.set(name, digest.toLowerCase())
    }
    return digests
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isSha256(value) {
    return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value)
}

/**
 * These bundles sign the raw blob, so the digest sits in `messageSignature`,
 * base64-encoded.
 * @param {string} bundleText
 * @returns {string}
 */
function readSignedDigest(bundleText) {
    try {
        const bundle = JSON.parse(bundleText)
        const encoded = bundle?.messageSignature?.messageDigest?.digest
        if (typeof encoded !== "string") {
            throw new Error("missing messageSignature.messageDigest.digest")
        }

        const digest = Buffer.from(encoded, "base64").toString("hex")
        if (!isSha256(digest)) {
            throw new Error("messageSignature.messageDigest.digest is not a sha256")
        }
        return digest
    } catch (error) {
        throw new Error(`Invalid Sigstore bundle: ${getErrorMessage(error)}`)
    }
}

/**
 * @typedef {Object} JibrilReleaseManifest
 * @prop {string} tag
 * @prop {Map<string, string>} subjects  sha256 by payload name
 */

/**
 * @param {string} manifestText
 * @returns {JibrilReleaseManifest}
 */
function parseReleaseManifest(manifestText) {
    try {
        const manifest = JSON.parse(manifestText)

        const tag = manifest?.release?.tag
        if (typeof tag !== "string" || tag === "") {
            throw new Error("missing release.tag")
        }

        if (!Array.isArray(manifest?.subjects)) {
            throw new Error("missing subjects")
        }

        /** @type {Map<string, string>} */
        const subjects = new Map()
        for (const subject of manifest.subjects) {
            const name = subject?.name
            const sha256 = subject?.sha256
            if (typeof name === "string" && isSha256(sha256)) {
                subjects.set(name, sha256.toLowerCase())
            }
        }

        return { tag, subjects }
    } catch (error) {
        throw new Error(`Invalid ${JIBRIL_MANIFEST}: ${getErrorMessage(error)}`)
    }
}

/**
 * Resolves the stop ceiling written into the unit's drop-in. An explicit
 * integer wins, where zero or negative means "no bound at all"; anything
 * unset or unparsable falls back to the default.
 * @param {string} overrideValue
 * @returns {number} seconds, or 0 when the bound is disabled
 */
export function resolveStopTimeoutSeconds(overrideValue) {
    const text = String(overrideValue === undefined || overrideValue === null ? "" : overrideValue).trim()
    if (!/^-?\d+$/.test(text)) {
        return DEFAULT_JIBRIL_STOP_TIMEOUT_SECONDS
    }

    const parsed = Number.parseInt(text, 10)
    if (!Number.isSafeInteger(parsed)) {
        return DEFAULT_JIBRIL_STOP_TIMEOUT_SECONDS
    }

    return parsed > 0 ? parsed : 0
}

/**
 * This function executes a command and returns captured stdout/stderr.
 * @param {string} command
 * @param {string[]=} args
 * @param {ExecOptions=} options
 * @returns {Promise<ExecCaptureResult>}
 */
async function execCapture(command, args, options = {}) {
    let stdout = ""
    let stderr = ""
    await exec.exec(command, args, {
        silent: options.silent ?? true,
        ...options,
        listeners: {
            stdout: data => {
                stdout += data.toString()
                options.listeners?.stdout?.(data)
            },
            stderr: data => {
                stderr += data.toString()
                options.listeners?.stderr?.(data)
            },
        },
    })
    return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
    }
}

/**
 * This function executes a command with sudo.
 * @param {string[]} args
 * @param {ExecOptions=} options
 */
async function execSudo(args, options = {}) {
    if (getEnv("DEBUG") === "true") {
        core.debug(`$ sudo -E ${args.join(" ")}`)
    }
    return exec.exec("sudo", ["-E", ...args], options)
}

/**
 * @typedef {Object} DownloadOptions
 * @prop {number=} [maxRedirects] - Maximum number of redirects to follow (default: 10)
 * @prop {number=} [timeoutMs] - Request timeout in milliseconds (default: 60000)
 * @prop {boolean=} [enforceHttps] - Whether to enforce HTTPS URLs (default: true)
 */

/**
 * This function downloads a file from a URL to a destination path.
 * @param {string} url
 * @param {string} destPath
 * @param {DownloadOptions=} opts
 * @returns {Promise<void>}
 */
async function downloadFile(url, destPath, opts = {}) {
    const { maxRedirects = 10, timeoutMs = 60_000, enforceHttps = true } = opts
    const requestURL = String(url || "")

    if (enforceHttps && !requestURL.startsWith("https://")) {
        throw new Error(`Refusing to download over non-HTTPS: ${requestURL}`)
    }

    const client = new HttpClient("garnet-action", undefined, {
        allowRedirects: true,
        maxRedirects,
        socketTimeout: timeoutMs,
    })

    try {
        const response = await client.get(requestURL)
        const statusCode = response.message.statusCode ?? 0

        if (statusCode !== 200) {
            response.message.resume()
            throw new Error(`Failed to download ${requestURL}: HTTP ${statusCode}`)
        }

        await pipeline(response.message, createWriteStream(destPath, { mode: 0o600 }))
    } catch (error) {
        await fs.rm(destPath, { force: true }).catch(() => {})
        throw error
    }
}

// Returns the first non-internal IPv4 address from network interfaces.
function getFirstIpv4() {
    const ifaces = os.networkInterfaces()
    for (const addrs of Object.values(ifaces)) {
        if (!addrs) {
            continue
        }
        for (const addr of addrs) {
            if (addr.family === "IPv4" && !addr.internal) {
                return addr.address
            }
        }
    }
    return null
}

/**
 * @param {NodeJS.Platform} platform
 * @returns {string}
 */
function normalizeAgentOs(platform) {
    if (platform === "win32") {
        return "windows"
    }

    return platform
}

/**
 * @param {string} arch
 * @returns {string}
 */
function normalizeAgentArch(arch) {
    if (arch === "x64") {
        return "amd64"
    }

    if (arch === "arm64") {
        return "arm64"
    }

    return arch
}

/**
 * Reads a file, returns null on permission error or missing file.
 * @param {string} filePath
 */
async function readFileSafe(filePath) {
    try {
        return (await fs.readFile(filePath, "utf8")).trim()
    } catch (_) {
        return null
    }
}

/**
 * Recursively lists files under a directory. Returns [] on error.
 * @param {string} dirPath
 */
async function readdirRecursiveSafe(dirPath) {
    try {
        const entries = await fs.readdir(dirPath, { recursive: true })
        return Array.isArray(entries) ? entries : []
    } catch (_) {
        return []
    }
}

/**
 * Redacts sensitive env vars from debug output (tokens, API keys).
 * @param {string|null} text
 */
function redactSensitive(text) {
    if (typeof text !== "string") return text
    return text
        .replace(/\bAI_TOKEN=[^\s\n]*/gi, "AI_TOKEN=***")
        .replace(/\bGITHUB_TOKEN=[^\s\n]*/gi, "GITHUB_TOKEN=***")
        .replace(/\bGARNET_API_TOKEN=[^\s\n]*/gi, "GARNET_API_TOKEN=***")
        .replace(/\bGARNET_AGENT_TOKEN=[^\s\n]*/gi, "GARNET_AGENT_TOKEN=***")
        .replace(/^([A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|KEY))=.*/gim, "$1=***")
        .replace(/(authorization:\s*(?:bearer|token|basic)\s+)[^\s\n]+/gi, "$1***")
}

/**
 * @param {string|null} text
 * @param {string} emptyMessage
 */
function formatCapturedOutput(text, emptyMessage) {
    const redacted = redactSensitive(text)
    if (redacted === null || redacted === "") {
        return emptyMessage
    }
    return redacted
}

// Dumps jibril stdout/stderr and journalctl when jibril fails in debug mode.
async function dumpJibrilLogs() {
    if (getEnv("DEBUG") !== "true") {
        return
    }

    /** @type {[string, string][]} */
    const logPaths = [
        ["/var/log/jibril.log", "Jibril stdout"],
        ["/var/log/jibril.err", "Jibril stderr"],
    ]
    for (const [logPath, label] of logPaths) {
        try {
            const { stdout, stderr } = await execCapture("sudo", ["cat", logPath], {
                ignoreReturnCode: true,
            })
            core.info(`--- ${label} (${logPath}) ---`)
            core.info(formatCapturedOutput(stdout, "(empty or file not found)"))
            if (stderr !== "") {
                core.info(`--- ${label} stderr (${logPath}) ---`)
                core.info(formatCapturedOutput(stderr, "(empty stderr)"))
            }
        } catch (_) {
            core.info(`--- ${label}: failed to read ---`)
        }
    }
    try {
        core.info("--- systemctl status ---")
        const { stdout, stderr } = await execCapture("sudo", ["systemctl", "status", "jibril.service", "--no-pager"], {
            ignoreReturnCode: true,
        })
        core.info(formatCapturedOutput(stdout, "(empty or failed)"))
        if (stderr !== "") {
            core.info("--- systemctl status stderr ---")
            core.info(formatCapturedOutput(stderr, "(empty stderr)"))
        }
    } catch (_) {}
    try {
        core.info("--- journalctl (last 50 lines) ---")
        const { stdout, stderr } = await execCapture(
            "sudo",
            ["journalctl", "-u", "jibril.service", "-n", "50", "--no-pager"],
            {
                ignoreReturnCode: true,
            },
        )
        core.info(formatCapturedOutput(stdout, "(empty or failed)"))
        if (stderr !== "") {
            core.info("--- journalctl stderr ---")
            core.info(formatCapturedOutput(stderr, "(empty stderr)"))
        }
    } catch (_) {}
}
