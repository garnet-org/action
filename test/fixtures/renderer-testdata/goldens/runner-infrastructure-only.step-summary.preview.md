## Garnet Execution Summary

### Workload context

| Field | Value |
| --- | --- |
| Profile | [019f2c11-aaaa-7bbb-8ccc-0123456789ab](https://app.garnet.ai/public/runs/32000000002?profile=019f2c11-aaaa-7bbb-8ccc-0123456789ab&utm_source=github&utm_medium=step_summary) |
| Workflow | <code>ci</code> |
| Job | <code>provision</code> |
| Repository | <code>garnet-org/runtime-review-testbed</code> |
| Commit | <code>cc33dd44ee55ff6677889900aabbccddee112233</code> |
| Run | [32000000002](https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000002) |
| Coverage | recorded at the kernel by Garnet. Capture is best-effort. |
| Workload activity | none recorded |
| Runner activity | 1&nbsp;execution chain · 1&nbsp;destination · 1&nbsp;destination association |
| Sensor network totals | network totals not recorded |
| Recorded at | 2026-08-07 13:00:00 UTC |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>hosted-compute-agent</code> <sub>pid&nbsp;2002</sub> | <code>hosted-compute-watchdog-prod-iad-01&#91;.&#93;githubapp</code> |

<details><summary><sub>Execution chains · 1&nbsp;destination association</sub></summary>

<pre>
systemd
└─ <strong>hosted-compute-agent</strong> <em>(pid 2002)</em>
   └─ ○ hosted-compute-watchdog-prod-iad-01&#91;.&#93;githubapp [140.82.113&#91;.&#93;41] :443 tcp <em>(github infra)</em>
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>hosted-compute-watchdog-prod-iad-01.githubapp [140.82.113.41] :443 tcp</code> | <code>systemd</code> → <code>hosted-compute-agent (pid 2002)</code> | (github infra) |

</details>

<details><summary><strong>Assertions</strong></summary>

No assertions recorded.

</details>

<div align="right">
<a href="https://app.garnet.ai/public/runs/32000000002?profile=019f2c11-aaaa-7bbb-8ccc-0123456789ab&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>
