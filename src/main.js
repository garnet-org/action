const core = require("@actions/core");
const { run } = require("./action");

// This is the main entry point for the action. It is called by the GitHub Actions
// runtime. The action installs the Jibril security scanner and sets it up as a
// systemd service. It retrieves the network policy for the repository and places
// it at /etc/jibril/netpolicy.yaml. The Jibril service is then started with
// logging directed to /var/log/jibril.log and /var/log/jibril.err.

async function main() {
  try {
    // Get the profiler file from the environment variable.
    const profiler4fun = core.getInput("profiler_4fun") === "true";

    let profilerFile;
    if (profiler4fun) {
      profilerFile = "/var/log/jibril.profiler4fun.out";
    } else {
      profilerFile = "/var/log/jibril.profiler.out";
    }

    core.saveState("profilerFile", profilerFile);
    core.saveState("profiler4fun", profiler4fun);
    core.saveState("debug", core.getInput("debug"));

    // Set inputs as environment variables for the action
    process.env.GARNET_API_TOKEN = core.getInput("api_token");
    // Ensure Jibril has a GitHub token even when the repo isn't checked out.
    process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    process.env.GARNET_API_URL = core.getInput("api_url");
    process.env.GARNETCTL_VERSION = core.getInput("garnetctl_version");
    process.env.JIBRIL_VERSION = core.getInput("jibril_version");
    process.env.DEBUG = core.getInput("debug");

    await run();
  } catch (err) {
    core.setFailed(err.message);
  }
}

main();
