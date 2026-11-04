## Garnet Execution Summary

### Workload context

| Field | Value |
| --- | --- |
| Workflow | <code>ci</code> |
| Job | <code>provision</code> |
| Repository | <code>garnet-org/runtime-review-testbed</code> |
| Commit | <code>dd44ee55ff6677889900aabbccddee1122334455</code> |
| Run | [32000000003](https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000003) |
| Coverage | recorded at the kernel by Garnet. Capture is best-effort. |
| Workload activity | none recorded |
| Runner activity | 2&nbsp;execution chains · 2&nbsp;destinations · 2&nbsp;destination associations |
| Sensor network totals | network totals not recorded |
| Recorded at | 2026-08-07 14:00:00 UTC |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>python3</code> <sub>pid&nbsp;5101</sub> | <code>169.254.169&#91;.&#93;254</code> |
| <code>systemd</code> → <code>walinuxagent</code> <sub>pid&nbsp;5102</sub> | <code>168.63.129&#91;.&#93;16</code> |

<details><summary><sub>Execution chains · 2&nbsp;destination associations</sub></summary>

<pre>
systemd
├─ <strong>walinuxagent</strong> <em>(pid 5102)</em>
│  └─ ○ 168.63.129&#91;.&#93;16 :80 tcp
└─ <strong>python3</strong> <em>(pid 5101)</em>
   └─ ○ 169.254.169&#91;.&#93;254 :80 tcp <em>(Cloud IMDS)</em>
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>169.254.169.254 :80 tcp</code> | <code>systemd</code> → <code>python3 (pid 5101)</code> | (Cloud IMDS) |
| <code>168.63.129.16 :80 tcp</code> | <code>systemd</code> → <code>walinuxagent (pid 5102)</code> | — |

</details>

<details><summary><strong>Assertions</strong></summary>

No assertions recorded.

</details>

<div align="right">
<strong>Powered by Garnet</strong>
</div>

---

## Garnet Execution Summary

### Workload context

| Field | Value |
| --- | --- |
| Workflow | <code>ci</code> |
| Job | <code>release</code> |
| Repository | <code>garnet-org/runtime-review-testbed</code> |
| Commit | <code>dd44ee55ff6677889900aabbccddee1122334455</code> |
| Run | [32000000003](https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000003) |
| Coverage | recorded at the kernel by Garnet. Capture is best-effort. |
| Workload activity | 2&nbsp;execution chains · 2&nbsp;destinations · 2&nbsp;destination associations |
| Runner activity | none recorded |
| Sensor network totals | network totals not recorded |
| Recorded at | 2026-08-07 14:00:00 UTC |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>bun</code> <sub>pid&nbsp;5002</sub><br><sub>step: <code>Run integration tests</code></sub> | <code>169.254.169&#91;.&#93;254</code> |
| <code>systemd</code> → <code>node</code> <sub>pid&nbsp;5001</sub><br><sub>step: <code>Publish artifacts</code></sub> | <code>artifacts.example&#91;.&#93;net</code> |

<details><summary><sub>Execution chains · 2&nbsp;destination associations</sub></summary>

<pre>
systemd
└─ Runner.Worker
   └─ bash
      └─ <strong>bun</strong> <em>(pid 5002)</em> <em>(step: &quot;Run integration tests&quot;)</em>
         └─ ○ 169.254.169&#91;.&#93;254 :80 tcp <em>(Cloud IMDS)</em>

systemd
└─ <strong>node</strong> <em>(pid 5001)</em> <em>(step: &quot;Publish artifacts&quot;)</em>
   └─ ○ artifacts.example&#91;.&#93;net [203.0.113&#91;.&#93;80] :443 tcp
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>169.254.169.254 :80 tcp</code> | <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>bun (pid 5002)</code> | step: 4. Run integration tests · (Cloud IMDS) |
| <code>artifacts.example.net [203.0.113.80] :443 tcp</code> | <code>systemd</code> → <code>node (pid 5001)</code> | step: 5. Publish artifacts |

</details>

<details><summary><strong>Assertions</strong></summary>

No assertions recorded.

</details>

<div align="right">
<strong>Powered by Garnet</strong>
</div>
