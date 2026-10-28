## Garnet Execution Summary

### Workload context

| Field | Value |
| --- | --- |
| Workflow | ci |
| Job | install |
| Repository | garnet-labs/posthog |
| Commit | 7777777777777777777777777777777777777777 |
| Run | [32100000007](https://github.com/garnet-labs/posthog/actions/runs/32100000007) |
| Coverage | recorded at the kernel by Garnet. Capture is best-effort. |
| Workload activity | 2&nbsp;execution chains · 4&nbsp;destinations · 4&nbsp;destination associations |
| Runner activity | 1&nbsp;execution chain · 1&nbsp;destination · 1&nbsp;destination association |
| Sensor network totals | network totals not recorded |
| Recorded at | 2026-08-07 18:30:00 UTC |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>npm</code> → <code>node</code> <sub>pid&nbsp;9001</sub><br><sub>step: &quot;Install&quot;</sub> | <code>registry.npmjs&#91;.&#93;org</code> |
| <code>systemd</code> → <code>…</code> → <code>node</code> → <code>sh</code> → <code>bun</code> <sub>pid&nbsp;9107</sub><br><sub>step: &quot;Install&quot;</sub> | · <code>api.github&#91;.&#93;com</code><br>· <code>169.254.169&#91;.&#93;254</code><br>· <code>release-assets.githubusercontent&#91;.&#93;com</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd</code> <sub>pid&nbsp;412</sub> | <code>resultsstorageeus2.blob.core.windows&#91;.&#93;net</code> |

<details><summary><sub>Execution chains · 5&nbsp;destination associations</sub></summary>

<pre>
systemd
└─ Runner.Worker
   └─ npm
      └─ <strong>node</strong> <em>(pid 9001)</em> <em>(step: &quot;Install&quot;)</em>
         └─ ○ registry.npmjs&#91;.&#93;org [104.16.30&#91;.&#93;34] :443 tcp

systemd
└─ Runner.Worker
   └─ npm
      └─ node
         └─ sh
            └─ <strong>bun</strong> <em>(pid 9107)</em> <em>(step: &quot;Install&quot;)</em>
               ├─ ○ api.github&#91;.&#93;com [140.82.112&#91;.&#93;6] :443 tcp
               ├─ ○ 169.254.169&#91;.&#93;254 :443 tcp <em>(Cloud IMDS)</em>
               └─ ○ release-assets.githubusercontent&#91;.&#93;com [185.199.108&#91;.&#93;133] :443 tcp

systemd
└─ hosted-compute-agent
   └─ sudo
      └─ <strong>provjobd</strong> <em>(pid 412)</em>
         └─ ○ resultsstorageeus2.blob.core.windows&#91;.&#93;net [20.60.153&#91;.&#93;129] :443 tcp
</pre>
</details>

<div align="right">
<strong>Powered by Garnet</strong>
</div>
