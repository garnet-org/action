const core = require("@actions/core");
const exec = require("@actions/exec");
const fs = require("fs");
const path = require("path");
const os = require("os");
const artifactClient = require("@actions/artifact").default;

// This is the post step for the action. It is called by the GitHub Actions
// runtime. It stops the Jibril service so the daemon flushes all pending events
// and writes the profiler markdown before we read it. It then reads the profiler
// markdown and appends it to the real GITHUB_STEP_SUMMARY.

async function run() {
  try {
    // Stop the Jibril service so the daemon flushes all pending events.
    core.info("stopping jibril service");
    await exec.exec("sudo", ["systemctl", "stop", "jibril.service"], { ignoreReturnCode: true });

    // Upload jibril logs as artifacts when debug is enabled (only after service stops).
    const debug = core.getState("debug");
    if (debug === "true") {
      await uploadJibrilArtifacts();
    }

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

async function uploadJibrilArtifacts() {
  const artifactDir = path.join(os.tmpdir(), "garnet-jibril-artifacts");
  fs.mkdirSync(artifactDir, { recursive: true });

  const logFiles = [
    ["/var/log/jibril.log", "jibril.log"],
    ["/var/log/jibril.err", "jibril.err"],
    ["/var/log/jibril.out", "jibril.out"],
  ];

  const uploaded = [];
  for (const [src, destName] of logFiles) {
    try {
      await exec.exec("sudo", ["cp", src, path.join(artifactDir, destName)], {
        ignoreReturnCode: true,
      });
      await exec.exec("sudo", ["chmod", "a+r", path.join(artifactDir, destName)], {
        ignoreReturnCode: true,
      });
      if (fs.existsSync(path.join(artifactDir, destName))) {
        uploaded.push(destName);
      }
    } catch (_) {}
  }

  if (uploaded.length === 0) {
    core.info("No jibril log files to upload");
    return;
  }

  try {
    await artifactClient.uploadArtifact("jibril-debug-logs", uploaded, artifactDir);
    core.info(`Uploaded jibril artifacts: ${uploaded.join(", ")}`);
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes("ACTIONS_RUNTIME_TOKEN") || msg.includes("AUTH_TOKEN") || msg.includes("token")) {
      core.warning(`Jibril artifact upload skipped (auth unavailable): ${msg}`);
    } else {
      core.warning(`Failed to upload jibril artifacts: ${msg}`);
    }
  } finally {
    fs.rmSync(artifactDir, { recursive: true, force: true });
  }
}

run();
