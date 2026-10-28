## Garnet Execution Summary

### Workload context

| Field | Value |
| --- | --- |
| Workflow | ci |
| Job | build |
| Repository | garnet-labs/posthog |
| Commit | aa11bb22cc33dd44ee55ff667788990011223344 |
| Run | [32100000002](https://github.com/garnet-labs/posthog/actions/runs/32100000002) |
| Coverage | recorded at the kernel by Garnet · best effort |
| Workload activity | 2&nbsp;execution chains · 2&nbsp;destinations · 2&nbsp;destination associations |
| Runner activity | 1&nbsp;execution chain · 2&nbsp;destinations · 2&nbsp;destination associations |
| Sensor network totals | network totals not recorded |
| Recorded at | 2026-08-07 18:30:00 UTC |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;5001</sub><br><sub>step: &quot;Build&quot;</sub> | <code>registry.npmjs&#91;.&#93;org</code> |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;5002</sub><br><sub>step: &quot;Build&quot;</sub> | <code>storage.googleapis&#91;.&#93;com</code> |
| <code>systemd</code> → <code>hosted-compute-</code> → <code>sudo</code> → <code>provjobd</code> <sub>pid&nbsp;5003</sub> | · <code>140.82.114.23</code><br>· <code>140.82.114.24</code> |

<details><summary><sub>Execution chains · 4&nbsp;destination associations</sub></summary>

<pre>
systemd
└─ Runner.Worker
   └─ bash
      ├─ <strong>node</strong> <em>(pid 5001)</em> <em>(step: &quot;Build&quot;)</em>
      │  └─ ○ registry.npmjs&#91;.&#93;org [104.16.24.34] :443 tcp
      └─ <strong>node</strong> <em>(pid 5002)</em> <em>(step: &quot;Build&quot;)</em>
         └─ ○ storage.googleapis&#91;.&#93;com [142.250.99.128] :443 tcp

systemd
└─ hosted-compute-
   └─ sudo
      └─ <strong>provjobd</strong> <em>(pid 5003)</em>
         ├─ ○ 140.82.114.23 :443 tcp
         └─ ○ 140.82.114.24 :443 tcp
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>registry.npmjs.org [104.16.24.34] :443 tcp</code> | <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node (pid 5001)</code> | step: 3. Build |
| <code>storage.googleapis.com [142.250.99.128] :443 tcp</code> | <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node (pid 5002)</code> | step: 3. Build |
| <code>140.82.114.23 :443 tcp</code> | <code>systemd</code> → <code>hosted-compute-</code> → <code>sudo</code> → <code>provjobd (pid 5003)</code> | — |
| <code>140.82.114.24 :443 tcp</code> | <code>systemd</code> → <code>hosted-compute-</code> → <code>sudo</code> → <code>provjobd (pid 5003)</code> | — |

</details>

<details><summary><strong>Assertions</strong></summary>

No assertions recorded.

</details>

<div align="right">
<strong>Powered by Garnet</strong>
</div>
