const core = require('@actions/core');
const { run } = require('./action');

// This is the main entry point for the action. It is called by the GitHub Actions
// runtime. The action installs the Jibril security scanner and sets it up as a
// systemd service. It retrieves the network policy for the repository and places
// it at /etc/jibril/netpolicy.yaml. The Jibril service is then started with
// logging directed to /var/log/jibril.log and /var/log/jibril.err.

async function main() {
  try {
    // Daemon writes profiler markdown to a stable path; post step reads it
    // and appends to the real GITHUB_STEP_SUMMARY. The daemon runs until the
    // job ends, so the main step's summary file is not the same as post's.
    const profiler4fun = core.getInput('profiler_4fun') === 'true';
    const profilerFile = profiler4fun
      ? '/var/log/jibril.profiler4fun.out'
      : (process.env.JIBRIL_PROFILER_FILE || '/var/log/jibril.profiler.out');
    core.saveState('profilerFile', profilerFile);
    core.saveState('debug', core.getInput('debug'));

    // Set inputs as environment variables for the action
    process.env.GARNET_API_TOKEN = core.getInput('api_token');
    process.env.GARNET_API_URL = core.getInput('api_url');
    process.env.GARNETCTL_VERSION = core.getInput('garnetctl_version');
    process.env.JIBRIL_VERSION = core.getInput('jibril_version');
    process.env.DEBUG = core.getInput('debug');
    process.env.JIBRIL_PROFILER_FILE = profilerFile;
    process.env.GITHUB_STEP_SUMMARY = profilerFile;

    await run();
  } catch (err) {
    core.setFailed(err.message);
  }
}

main();
