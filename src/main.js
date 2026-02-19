const core = require('@actions/core');
const exec = require('@actions/exec');
const path = require('path');
const fs = require('fs');

async function run() {
  try {
    const actionPath = process.env.GITHUB_ACTION_PATH;
    const scriptPath = path.join(actionPath, 'scripts', 'action.sh');

    fs.chmodSync(scriptPath, '755');

    // Save the profiler file path for the post step.
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
        // JIBRIL_PROFILER_FILE is intentionally kept as-is from the
        // environment — the daemon reads it from /etc/default/jibril
        // which action.sh already populates with GITHUB_STEP_SUMMARY.
        // We override it here to a stable intermediate path so the
        // post step can reliably read it regardless of step context.
        JIBRIL_PROFILER_FILE:       profilerFile,
        GITHUB_STEP_SUMMARY:        profilerFile,
      },
    });
  } catch (err) {
    core.setFailed(err.message);
  }
}

run();
