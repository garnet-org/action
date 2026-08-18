## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Workflow | ci |
| Repository | garnet-org/runtime-review-testbed |
| Commit | dd44ee55ff6677889900aabbccddee1122334455 |
| Run ID / Job | 32000000003 / provision |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>python3</code> <sub>pid&nbsp;5101</sub> | <code>169.254.169.254</code> |
| <code>systemd</code> → <code>walinuxagent</code> <sub>pid&nbsp;5102</sub> | <code>168.63.129.16</code> |

<details><summary><sub>Full recorded tree</sub></summary>

<pre>
systemd
├─ <strong>walinuxagent</strong>
│  └─ ○ 168.63.129.16
└─ <strong>python3</strong>
   └─ ○ 169.254.169.254 <em>(cloud metadata)</em>
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>169.254.169.254 :80 tcp</code> | <code>systemd</code> → <code>python3 (pid 5101)</code> | (cloud metadata) |
| <code>168.63.129.16 :80 tcp</code> | <code>systemd</code> → <code>walinuxagent (pid 5102)</code> | — |

</details>

<details><summary><strong>Assertions</strong></summary>

No assertions recorded.

</details>

<div align="right">
<sub>2026-08-07 14:00:00 UTC</sub><br>
<strong>Powered by Garnet</strong>
</div>

<sub><a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000003">Job summary generated at run-time</a></sub>

---

## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Workflow | ci |
| Repository | garnet-org/runtime-review-testbed |
| Commit | dd44ee55ff6677889900aabbccddee1122334455 |
| Run ID / Job | 32000000003 / release |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>bun</code> <sub>pid&nbsp;5002</sub> | <code>169.254.169.254</code> |
| <code>systemd</code> → <code>node</code> <sub>pid&nbsp;5001</sub> | <code>artifacts.example.net</code> |

<details><summary><sub>Full recorded tree</sub></summary>

<pre>
Runner.Worker
└─ bash
   └─ <strong>bun</strong> <em>(step: &quot;Run integration tests&quot;)</em>
      └─ ○ 169.254.169.254 <em>(cloud metadata)</em>

systemd
└─ <strong>node</strong> <em>(step: &quot;Publish artifacts&quot;)</em>
   └─ ○ artifacts.example.net
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>169.254.169.254 :80 tcp</code> | <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>bun (pid 5002)</code> | step: 4. Run integration tests · (cloud metadata) |
| <code>artifacts.example.net [203.0.113.80] :443 tcp</code> | <code>systemd</code> → <code>node (pid 5001)</code> | step: 5. Publish artifacts |

</details>

<details><summary><strong>Assertions</strong></summary>

No assertions recorded.

</details>

<div align="right">
<sub>2026-08-07 14:00:00 UTC</sub><br>
<strong>Powered by Garnet</strong>
</div>

<sub><a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000003">Job summary generated at run-time</a></sub>
