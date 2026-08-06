import * as core from "@actions/core"
import * as os from "node:os"
import { run } from "./action.js"
import { formatRunnerEnvironment } from "./coverage.js"
import { collectRunnerEnvironment, emitCanaryConnection } from "./coverage-probe.js"
import { buildReportLink } from "./profile-comment.js"
import { getEnv, isSupportedArch, isSupportedPlatform } from "./shared.js"

// This is the main entry point for the action. It is called by the GitHub Actions
// runtime. The action installs the Jibril security scanner and sets it up as a
// systemd service. It retrieves the network policy for the repository and places
// it at /etc/jibril/netpolicy.yaml. The Jibril service is then started with
// logging directed to /var/log/jibril.log and /var/log/jibril.err.

async function main() {
    const platform = os.platform()
    if (!isSupportedPlatform(platform)) {
        core.info(`Garnet runtime monitoring requires Linux (eBPF-based). Skipping on ${platform}.`)
        return
    }

    const arch = os.arch()
    if (!isSupportedArch(arch)) {
        core.info(
            `Garnet runtime monitoring requires x86_64 (jibril is only available for amd64). Skipping on ${arch}.`,
        )
        return
    }

    try {
        // Save debug state for later retrieval.
        const debug = core.getInput("debug") === "true"
        core.saveState("debug", debug ? "true" : "")

        const githubToken = core.getInput("github_token")
        core.saveState("githubToken", githubToken)

        // Set inputs as environment variables for the action
        process.env.GARNET_API_TOKEN = core.getInput("api_token")

        // Make the token available to both the main and post steps when provided.
        if (githubToken !== "") {
            process.env.GITHUB_TOKEN = githubToken
        }
        process.env.GARNET_API_URL = core.getInput("api_url")
        process.env.JIBRIL_VERSION = core.getInput("jibril_version")
        process.env.DEBUG = core.getInput("debug")

        // The report_url output derives from the run id and the configured
        // API host, so it is known up front — emit it here where later steps
        // in the same job can consume it (post-step outputs are not visible
        // to them).
        core.setOutput(
            "report_url",
            buildReportLink({
                repository: getEnv("GITHUB_REPOSITORY"),
                run_id: getEnv("GITHUB_RUN_ID"),
                job: getEnv("GITHUB_JOB"),
            }),
        )

        // Set the default profile printer file paths.
        const profilerFile = process.env.JIBRIL_PROFILER_FILE || "/var/log/jibril.profiler.out"
        const jsonProfilerFile = process.env.JIBRIL_JSONPROFILER_FILE || "/var/log/jibril.profile.json"
        process.env.JIBRIL_PROFILER_FILE = profilerFile
        process.env.JIBRIL_JSONPROFILER_FILE = jsonProfilerFile
        core.saveState("profilerFile", profilerFile)
        core.saveState("jsonProfilerFile", jsonProfilerFile)

        const jibrilStarted = await run()
        if (jibrilStarted) {
            core.saveState("jibrilStarted", "true")

            // Coverage instrumentation: record kernel facts and make one known
            // outbound connection while Jibril is recording, so the post step
            // can verify that network capture actually works on this runner
            // (custom microVM kernels on alternative CI providers may lack the
            // eBPF features Jibril needs while the daemon stays "active").
            const environment = await collectRunnerEnvironment()
            core.info(`Runner environment: ${formatRunnerEnvironment(environment)}`)
            core.saveState("runnerEnvironment", JSON.stringify(environment))

            const canaryDomain = await emitCanaryConnection(getEnv("GARNET_API_URL", "https://api.garnet.ai"))
            if (canaryDomain === "") {
                core.info("coverage canary connection could not be made; post step will rely on recorded totals only")
            }
            core.saveState("coverageCanaryDomain", canaryDomain)
        }
    } catch (err) {
        if (err instanceof Error) {
            core.warning(
                `Garnet action encountered an unexpected error and will continue without runtime monitoring: ${err.message}`,
            )
        } else {
            core.warning(
                `Garnet action encountered an unexpected error and will continue without runtime monitoring: ${String(err)}`,
            )
        }
    }
}

main()
