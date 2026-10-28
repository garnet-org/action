## Garnet Execution Summary

### Workload context

| Field | Value |
| --- | --- |
| Workflow | ci |
| Job | branches |
| Repository | garnet-org/runtime-review-testbed |
| Commit | bb22cc33dd44ee55ff6677889900aabbccddee11 |
| Run | [32000000020](https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000020) |
| Coverage | recorded at the kernel by Garnet. Capture is best-effort. |
| Workload activity | 2&nbsp;execution chains · 3&nbsp;destinations · 3&nbsp;destination associations |
| Runner activity | none recorded |
| Sensor network totals | network totals not recorded |
| Recorded at | 2026-08-07 16:00:00 UTC |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;5001</sub><br><sub>step: &quot;Run tests&quot;</sub> | · <code>kept.example&#91;.&#93;com</code><br>· <code>fresh.example&#91;.&#93;net</code> |
| <code>systemd</code> → <code>…</code> → <code>bash</code> → <code>python3</code> → <code>pip</code> <sub>pid&nbsp;5002</sub><br><sub>step: &quot;Install tools&quot;</sub> | <code>pypi.example&#91;.&#93;org</code> |

<details><summary><sub>Execution chains · 3&nbsp;destination associations</sub></summary>

<pre>
systemd
└─ Runner.Worker
   └─ bash
      └─ <strong>node</strong> <em>(pid 5001)</em> <em>(step: &quot;Run tests&quot;)</em>
         ├─ ○ kept.example&#91;.&#93;com [198.51.100&#91;.&#93;7] :443 tcp
         └─ ○ fresh.example&#91;.&#93;net [198.51.100&#91;.&#93;8] :443 tcp

systemd
└─ Runner.Worker
   └─ bash
      └─ python3
         └─ <strong>pip</strong> <em>(pid 5002)</em> <em>(step: &quot;Install tools&quot;)</em>
            └─ ○ pypi.example&#91;.&#93;org [198.51.100&#91;.&#93;9] :443 tcp
</pre>
</details>

<div align="right">
<strong>Powered by Garnet</strong>
</div>
