## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Workflow | ci |
| Repository | garnet-labs/posthog |
| Commit | aa11bb22cc33dd44ee55ff667788990011223344 |
| Run ID / Job | 32100000002 / build |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;5001</sub> | <code>registry.npmjs.org</code> |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;5002</sub> | <code>storage.googleapis.com</code> |
| <code>systemd</code> → <code>hosted-compute-</code> → <code>sudo</code> → <code>provjobd</code> <sub>pid&nbsp;5003</sub> | · <code>140.82.114.23</code><br>· <code>140.82.114.24</code> |

<details><summary><sub>Full recorded tree</sub></summary>

<pre>
Runner.Worker
└─ bash
   └─ <strong>node</strong> <em>(step: &quot;Build&quot;)</em>
      ├─ ○ registry.npmjs.org
      └─ ○ storage.googleapis.com

systemd
└─ hosted-compute-
   └─ sudo
      └─ <strong>provjobd</strong>
         ├─ ○ 140.82.114.23
         └─ ○ 140.82.114.24
</pre>
</details>

<div align="right">
<sub>2026-08-07 18:30:00 UTC</sub><br>
<strong>Powered by Garnet</strong>
</div>

<sub><a href="https://github.com/garnet-labs/posthog/actions/runs/32100000002">Job summary generated at run-time</a></sub>
