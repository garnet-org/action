## Garnet Execution Summary

### Workload context

| Field | Value |
| --- | --- |
| Workflow | ci |
| Job | build |
| Repository | garnet-labs/posthog |
| Commit | 7777777777777777777777777777777777777777 |
| Run | [32100000003](https://github.com/garnet-labs/posthog/actions/runs/32100000003) |
| Coverage | recorded at the kernel by Garnet. Capture is best-effort. |
| Workload activity | 1&nbsp;execution chain · 1&nbsp;destination · 1&nbsp;destination association |
| Runner activity | 2&nbsp;execution chains · 2&nbsp;destinations · 2&nbsp;destination associations |
| Sensor network totals | network totals not recorded |
| Recorded at | 2026-08-07 18:30:00 UTC |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>npm</code> → <code>node</code> <sub>pid&nbsp;9101</sub><br><sub>step: &quot;Install&quot;</sub> | <code>registry.npmjs&#91;.&#93;org</code> |
| <code>systemd</code> → <code>hosted-compute-</code> → <code>sudo</code> → <code>provjobd</code> <sub>pid&nbsp;9103</sub> | <code>glb-p4a577-public-internal.githubapp&#91;.&#93;com</code> |
| <code>systemd</code> → <code>hosted-compute-</code> → <code>sudo</code> → <code>provjobd</code> <sub>pid&nbsp;9102</sub> | <code>resultsstorageeus2.blob.core.windows&#91;.&#93;net</code> |

<details><summary><sub>Execution chains · 3&nbsp;destination associations</sub></summary>

<pre>
systemd
└─ Runner.Worker
   └─ npm
      └─ <strong>node</strong> <em>(pid 9101)</em> <em>(step: &quot;Install&quot;)</em>
         └─ ○ registry.npmjs&#91;.&#93;org [104.16.30&#91;.&#93;34] :443 tcp

systemd
└─ hosted-compute-
   └─ sudo
      ├─ <strong>provjobd</strong> <em>(pid 9103)</em>
      │  └─ ○ glb-p4a577-public-internal.githubapp&#91;.&#93;com [140.82.114&#91;.&#93;22] :443 tcp <em>(github infra)</em>
      └─ <strong>provjobd</strong> <em>(pid 9102)</em>
         └─ ○ resultsstorageeus2.blob.core.windows&#91;.&#93;net [20.60.10&#91;.&#93;4] :443 tcp
</pre>
</details>

<div align="right">
<strong>Powered by Garnet</strong>
</div>
