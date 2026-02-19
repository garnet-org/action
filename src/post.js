const core = require("@actions/core");
const exec = require("@actions/exec");
const fs = require("fs");

// This is the post step for the action. It is called by the GitHub Actions
// runtime. It stops the Jibril service so the daemon flushes all pending events
// and writes the profiler markdown before we read it. It then reads the profiler
// markdown and appends it to the real GITHUB_STEP_SUMMARY.

async function run() {
  try {
    // Stop the Jibril service so the daemon flushes all pending events.
    core.info("stopping jibril service");
    await exec.exec("sudo", ["systemctl", "stop", "jibril.service"], { ignoreReturnCode: true });

    const profilerFile =
      core.getState("profilerFile") || process.env.JIBRIL_PROFILER_FILE || "/var/log/jibril.profiler.out";

    // Read the profiler markdown from the file.
    let content;
    try {
      const result = await exec.getExecOutput("sudo", ["cat", profilerFile], {
        silent: true,
        ignoreReturnCode: true,
      });
      if (result.exitCode !== 0) {
        core.warning(`profiler output not found or unreadable: ${profilerFile}`);
        return;
      }
      content = (result.stdout || "").trim();
    } catch (e) {
      core.warning(`failed to read profiler file: ${e.message}`);
      return;
    }
    if (!content) {
      core.warning("profiler output is empty, skipping summary");
      return;
    }

    // Get the summary file from the environment variable.
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryFile) {
      core.warning("GITHUB_STEP_SUMMARY is not set, cannot write summary");
      return;
    }

    // Append the profiler markdown to the job summary file.
    fs.appendFileSync(summaryFile, "\n" + content + "\n");

    core.info("profiler markdown written to job summary");
  } catch (err) {
    // Never fail the job because of the profiler step.
    core.warning(`failed to write summary: ${err.message}`);
  }
}

run();
