const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');

async function run() {
  try {
    // Stop the Jibril service so the daemon flushes all pending events
    // and writes the profiler markdown before we read it.
    core.info('stopping jibril service');
    await exec.exec('sudo', ['systemctl', 'stop', 'jibril.service'], {
      ignoreReturnCode: true,
    });

    const profilerFile = core.getState('profilerFile')
      || process.env.JIBRIL_PROFILER_FILE
      || '/var/log/jibril.profiler.out';

    if (!fs.existsSync(profilerFile)) {
      core.warning(`profiler output not found: ${profilerFile}`);
      return;
    }

    const content = fs.readFileSync(profilerFile, 'utf8').trim();
    if (!content) {
      core.warning('profiler output is empty, skipping summary');
      return;
    }

    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryFile) {
      core.warning('GITHUB_STEP_SUMMARY is not set, cannot write summary');
      return;
    }

    // Append with a newline separator to avoid merging with prior content.
    fs.appendFileSync(summaryFile, '\n' + content + '\n');
    core.info('security profile written to job summary');
  } catch (err) {
    // Never fail the job because of the summary step.
    core.warning(`failed to write summary: ${err.message}`);
  }
}

run();
