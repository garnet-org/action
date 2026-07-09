// This script installs jibril, calls the control-plane API to create the
// agent and fetch network policy, and sets up Jibril as a systemd service.

import * as core from "@actions/core"
import * as exec from "@actions/exec"
import { HttpClient } from "@actions/http-client"
import { createWriteStream } from "node:fs"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { pipeline } from "node:stream/promises"
import { createGitHubContext, getProfileJobName, getWorkflowFilePath } from "./github-context.js"
import { ControlPlaneClient } from "./control-plane/client.js"
import { getEnv, getErrorMessage, isSupportedArch, isSupportedPlatform, pathExists, waitForDelay } from "./shared.js"

/**
 * @typedef {import("@actions/exec").ExecOptions} ExecOptions
 */

/**
 * @typedef {{ stdout: string, stderr: string }} ExecCaptureResult
 */

const INSTPATH = "/usr/local/bin"

// This function is the main entry point for the script.
// Returns true when Jibril started successfully, false otherwise.
export async function run() {
    let tmpDir = ""
    try {
        // Get the variables from the environment.
        const TOKEN = getEnv("GARNET_API_TOKEN")
        const API = getEnv("GARNET_API_URL", "https://api.garnet.ai")
        let JIBRILVER = resolveJibrilVersion(getEnv("JIBRIL_VERSION", ""), getEnv("GITHUB_ACTION_REF", ""))
        const DEBUG = getEnv("DEBUG", "false")

        if (TOKEN === "") {
            throw new Error(
                "Input 'api_token' is required. This commonly happens on pull requests from forks, where repository secrets are not exposed to workflows. Add/verify that your workflow passes a valid token to this input, or conditionally skip this action for forked PRs.",
            )
        }

        // Prevent accidental leakage of tokens in logs.
        core.setSecret(TOKEN)
        const GITHUB_TOKEN = getEnv("GITHUB_TOKEN", "")
        if (GITHUB_TOKEN) core.setSecret(GITHUB_TOKEN)
        const AI_TOKEN = getEnv("AI_TOKEN", "")
        if (AI_TOKEN) core.setSecret(AI_TOKEN)

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

        core.info(`API server: ${API}`)
        core.info(`Jibril Version: ${JIBRILVER}`)

        // Create a temporary directory for the script to use.
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "garnet-"))

        // Download jibril
        const jibrilPrefix = "https://github.com/garnet-org/jibril-releases/releases"
        let jibrilURL =
            JIBRILVER === "latest"
                ? `${jibrilPrefix}/latest/download/jibril`
                : `${jibrilPrefix}/download/${JIBRILVER}/jibril`

        core.info(`Downloading jibril: ${jibrilURL}`)

        const jibrilDest = path.join(tmpDir, "jibril")
        await downloadFile(jibrilURL, jibrilDest)
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
            projectToken: TOKEN,
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
 * @param {string} inputVersion
 * @param {string} actionRef
 */
function resolveJibrilVersion(inputVersion, actionRef) {
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
    if (ref === "v2") return "v2.10.8"

    // Default for other refs (branch/SHA/etc).
    return "latest"
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
