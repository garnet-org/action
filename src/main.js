import * as core from "@actions/core"
import { run } from "./action.js"

// This is the main entry point for the action. It is called by the GitHub Actions
// runtime. The action installs the Jibril security scanner and sets it up as a
// systemd service. It retrieves the network policy for the repository and places
// it at /etc/jibril/netpolicy.yaml. The Jibril service is then started with
// logging directed to /var/log/jibril.log and /var/log/jibril.err.

async function main() {
  try {
    // Save whether profiler4fun mode is enabled as a boolean.
    const profiler4fun = core.getInput("profiler_4fun") === "true"

    // Store as string for state passing to post.js.
    core.saveState("profiler4fun", profiler4fun ? "true" : "")
    core.saveState(
      "selectedProfiler",
      profiler4fun ? "profiler4fun" : "profiler",
    )

    // Save debug state for later retrieval.
    const debug = core.getInput("debug") === "true"
    core.saveState("debug", debug ? "true" : "")

    // Set inputs as environment variables for the action
    process.env.GARNET_API_TOKEN = core.getInput("api_token")

    // Ensure Jibril has a GitHub token even when the repo isn't checked out.
    process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN
    process.env.GARNET_API_URL = core.getInput("api_url")
    process.env.GARNETCTL_VERSION = core.getInput("garnetctl_version")
    process.env.JIBRIL_VERSION = core.getInput("jibril_version")
    process.env.DEBUG = core.getInput("debug")

    // Set the default profiler printer file paths.
    const profilerFile =
      process.env.JIBRIL_PROFILER_FILE || "/var/log/jibril.profiler.out"
    const profiler4funFile =
      process.env.JIBRIL_PROFILER4FUN_FILE || "/var/log/jibril.profiler4fun.out"
    const jsonProfilerFile =
      process.env.JIBRIL_JSONPROFILER_FILE || "/var/log/jibril.profile.json"
    process.env.JIBRIL_PROFILER_FILE = profilerFile
    process.env.JIBRIL_PROFILER4FUN_FILE = profiler4funFile
    process.env.JIBRIL_JSONPROFILER_FILE = jsonProfilerFile
    core.saveState("profilerFile", profilerFile)
    core.saveState("profiler4funFile", profiler4funFile)
    core.saveState("jsonProfilerFile", jsonProfilerFile)
    core.saveState(
      "selectedProfilerFile",
      profiler4fun ? profiler4funFile : profilerFile,
    )

    await run()
  } catch (err) {
    if (err instanceof Error) {
      core.setFailed(err.message)
    } else {
      core.setFailed(String(err))
    }
  }
}

main()
