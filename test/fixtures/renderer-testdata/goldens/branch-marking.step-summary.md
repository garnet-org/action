## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Workflow | ci |
| Repository | garnet-org/runtime-review-testbed |
| Commit | bb22cc33dd44ee55ff6677889900aabbccddee11 |
| Run ID / Job | 32000000020 / branches |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;5001</sub> | · <code>kept.example.com</code><br>· <code>fresh.example.net</code> |
| <code>systemd</code> → <code>…</code> → <code>bash</code> → <code>python3</code> → <code>pip</code> <sub>pid&nbsp;5002</sub> | <code>pypi.example.org</code> |

<details><summary><sub>Full recorded tree</sub></summary>

<pre>
Runner.Worker
└─ bash
   ├─ <strong>node</strong> <em>(step: &quot;Run tests&quot;)</em>
   │  ├─ ○ fresh.example.net
   │  └─ ○ kept.example.com
   └─ python3
      └─ <strong>pip</strong> <em>(step: &quot;Install tools&quot;)</em>
         └─ ○ pypi.example.org
</pre>
</details>

<div align="right">
<sub>2026-08-07 16:00:00 UTC</sub><br>
<strong>Powered by Garnet</strong>
</div>

<sub><a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000020">Job summary generated at run-time</a></sub>
