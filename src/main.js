const core = require('@actions/core');
const exec = require('@actions/exec');
const path = require('path');
const fs = require('fs');

// This is the main entry point for the action. It is called by the GitHub Actions
// runtime. It runs the action.sh script with the appropriate environment variables.
// The action.sh script is a wrapper around the Jibril security scanner.

// The action installs the Jibril security scanner and sets it up as a systemd service.
// It retrieves the network policy for the repository and places it at
// /etc/jibril/netpolicy.yaml. The Jibril service is then started with logging
// directed to /var/log/jibril.log and /var/log/jibril.err.

async function run() {
  try {
    const actionPath = process.env.GITHUB_ACTION_PATH;
    const scriptPath = path.join(actionPath, 'scripts', 'action.sh');

    fs.chmodSync(scriptPath, '755');

    // Daemon writes profiler markdown to a stable path; post step reads it
    // and appends to the real GITHUB_STEP_SUMMARY. The daemon runs until the
    // job ends, so the main step's summary file is not the same as post's.
    const profilerFile = process.env.JIBRIL_PROFILER_FILE
      || '/var/log/jibril.profiler.out';
    core.saveState('profilerFile', profilerFile);

    await exec.exec('sudo', ['-E', scriptPath], {
      env: {
        ...process.env,
        GARNET_API_TOKEN:           core.getInput('api_token'),
        GARNET_API_URL:             core.getInput('api_url'),
        GARNETCTL_VERSION:          core.getInput('garnetctl_version'),
        JIBRIL_VERSION:             core.getInput('jibril_version'),
        DEBUG:                      core.getInput('debug'),
        JIBRIL_PROFILER_FILE:       profilerFile,
        GITHUB_STEP_SUMMARY:        profilerFile,
      },
    });
  } catch (err) {
    core.setFailed(err.message);
  }
}

run();
