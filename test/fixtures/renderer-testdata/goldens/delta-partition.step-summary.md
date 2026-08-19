## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Workflow | ci |
| Repository | garnet-labs/posthog |
| Commit | 7777777777777777777777777777777777777777 |
| Run ID / Job | 32100000002 / build |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>npm</code> → <code>node</code> <sub>pid&nbsp;9001</sub> | <code>registry.npmjs.org</code> |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>npm</code> → <code>node</code> <sub>pid&nbsp;9002</sub> | <code>evil-mirror.example.com</code> |
| <code>systemd</code> → <code>hosted-compute-</code> → <code>sudo</code> → <code>provjobd</code> <sub>pid&nbsp;9004</sub> | <code>glb-p4a577-public-internal.githubapp.com</code> |
| <code>systemd</code> → <code>hosted-compute-</code> → <code>sudo</code> → <code>provjobd</code> <sub>pid&nbsp;9003</sub> | <code>resultsstorageeus2.blob.core.windows.net</code> |

<details><summary><sub>Full recorded tree</sub></summary>

<pre>
Runner.Worker
└─ npm
   └─ <strong>node</strong> <em>(step: &quot;Install&quot;)</em>
      ├─ ○ evil-mirror.example.com
      └─ ○ registry.npmjs.org

systemd
└─ hosted-compute-
   └─ sudo
      └─ <strong>provjobd</strong>
         ├─ ○ glb-p4a577-public-internal.githubapp.com <em>(github infra)</em>
         └─ ○ resultsstorageeus2.blob.core.windows.net
</pre>
</details>

<div align="right">
<sub>2026-08-07 18:30:00 UTC</sub><br>
<strong>Powered by Garnet</strong>
</div>

<sub><a href="https://github.com/garnet-labs/posthog/actions/runs/32100000002">Job summary generated at run-time</a></sub>
