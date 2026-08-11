## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Profile UUID | 019f2c11-aaaa-7bbb-8ccc-0123456789ab |
| Workflow | ci |
| Repository | garnet-org/runtime-review-testbed |
| Commit | cc33dd44ee55ff6677889900aabbccddee112233 |
| Run ID / Job | 32000000002 / provision |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>hosted-compute-agent (pid 2002)</code> | <code>hosted-compute-watchdog-prod-iad-01.githubapp</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd734003200 (pid 2001)</code> | <code>localhost</code> |

<div align="right">
<sub>2026-08-07 13:00:00 UTC</sub><br>
<a href="https://app.garnet.ai/public/runs/32000000002?profile=019f2c11-aaaa-7bbb-8ccc-0123456789ab&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>

<sub><a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000002">Job summary generated at run-time</a></sub>
