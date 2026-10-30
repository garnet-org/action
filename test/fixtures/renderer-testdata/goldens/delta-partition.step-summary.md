## Garnet Execution Summary

### Workload context

| Field | Value |
| --- | --- |
| Workflow | <code>ci</code> |
| Job | <code>build</code> |
| Repository | <code>garnet-labs/posthog</code> |
| Commit | <code>7777777777777777777777777777777777777777</code> |
| Run | [32100000002](https://github.com/garnet-labs/posthog/actions/runs/32100000002) |
| Coverage | recorded at the kernel by Garnet. Capture is best-effort. |
| Workload activity | 2&nbsp;execution chains · 2&nbsp;destinations · 2&nbsp;destination associations |
| Runner activity | 2&nbsp;execution chains · 2&nbsp;destinations · 2&nbsp;destination associations |
| Sensor network totals | network totals not recorded |
| Recorded at | 2026-08-07 18:30:00 UTC |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>npm</code> → <code>node</code> <sub>pid&nbsp;9001</sub><br><sub>step: <code>Install</code></sub> | <code>registry.npmjs&#91;.&#93;org</code> |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>npm</code> → <code>node</code> <sub>pid&nbsp;9002</sub><br><sub>step: <code>Install</code></sub> | <code>evil-mirror.example&#91;.&#93;com</code> |
| <code>systemd</code> → <code>hosted-compute-</code> → <code>sudo</code> → <code>provjobd</code> <sub>pid&nbsp;9004</sub> | <code>glb-p4a577-public-internal.githubapp&#91;.&#93;com</code> |
| <code>systemd</code> → <code>hosted-compute-</code> → <code>sudo</code> → <code>provjobd</code> <sub>pid&nbsp;9003</sub> | <code>resultsstorageeus2.blob.core.windows&#91;.&#93;net</code> |

<details><summary><sub>Execution chains · 4&nbsp;destination associations</sub></summary>

<pre>
systemd
└─ Runner.Worker
   └─ npm
      ├─ <strong>node</strong> <em>(pid 9002)</em> <em>(step: &quot;Install&quot;)</em>
      │  └─ ○ evil-mirror.example&#91;.&#93;com [198.51.100&#91;.&#93;60] :443 tcp
      └─ <strong>node</strong> <em>(pid 9001)</em> <em>(step: &quot;Install&quot;)</em>
         └─ ○ registry.npmjs&#91;.&#93;org [104.16.30&#91;.&#93;34] :443 tcp

systemd
└─ hosted-compute-
   └─ sudo
      ├─ <strong>provjobd</strong> <em>(pid 9004)</em>
      │  └─ ○ glb-p4a577-public-internal.githubapp&#91;.&#93;com [140.82.114&#91;.&#93;22] :443 tcp <em>(github infra)</em>
      └─ <strong>provjobd</strong> <em>(pid 9003)</em>
         └─ ○ resultsstorageeus2.blob.core.windows&#91;.&#93;net [20.60.10&#91;.&#93;4] :443 tcp
</pre>
</details>

<div align="right">
<strong>Powered by Garnet</strong>
</div>
