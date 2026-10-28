## Garnet Execution Summary

### Workload context

| Field | Value |
| --- | --- |
| Workflow | ci |
| Job | api |
| Repository | garnet-org/runtime-review-testbed |
| Commit | bb22cc33dd44ee55ff6677889900aabbccddee11 |
| Run | [32000000001](https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000001) |
| Coverage | recorded at the kernel by Garnet. Capture is best-effort. |
| Workload activity | 4&nbsp;execution chains · 4&nbsp;destinations · 4&nbsp;destination associations |
| Runner activity | 2&nbsp;execution chains · 2&nbsp;destinations · 2&nbsp;destination associations |
| Sensor network totals | network totals not recorded |
| Recorded at | 2026-08-07 12:00:00 UTC |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;4004</sub><br><sub>step: &quot;Run api tests&quot;</sub> | <code>cache.internal&#91;.&#93;example</code> |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;4003</sub><br><sub>step: &quot;Run api tests&quot;</sub> | <code>flap-b.example&#91;.&#93;com</code> |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;4001</sub><br><sub>step: &quot;Run api tests&quot;</sub> | <code>kept.example&#91;.&#93;com</code> |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;4002</sub><br><sub>step: &quot;Run api tests&quot;</sub> | <code>fresh.example&#91;.&#93;net</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> <sub>pid&nbsp;1901</sub> | <code>telemetry&#91;.&#93;example</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd104857600</code> <sub>pid&nbsp;1902</sub> | <code>glb-2a3c35-public-internal.githubapp&#91;.&#93;com</code> |

<details><summary><sub>Execution chains · 6&nbsp;destination associations</sub></summary>

<pre>
systemd
└─ Runner.Worker
   └─ bash
      ├─ <strong>node</strong> <em>(pid 4004)</em> <em>(step: &quot;Run api tests&quot;)</em>
      │  └─ ○ cache.internal&#91;.&#93;example [192.0.2&#91;.&#93;40] :6379 tcp
      ├─ <strong>node</strong> <em>(pid 4003)</em> <em>(step: &quot;Run api tests&quot;)</em>
      │  └─ ○ flap-b.example&#91;.&#93;com [198.51.100&#91;.&#93;61] :443 tcp
      ├─ <strong>node</strong> <em>(pid 4001)</em> <em>(step: &quot;Run api tests&quot;)</em>
      │  └─ ○ kept.example&#91;.&#93;com [198.51.100&#91;.&#93;7] :443 tcp
      └─ <strong>node</strong> <em>(pid 4002)</em> <em>(step: &quot;Run api tests&quot;)</em>
         └─ ○ fresh.example&#91;.&#93;net [203.0.113&#91;.&#93;14] :443 tcp

systemd
└─ <strong>hosted-compute-agent</strong> <em>(pid 1901)</em>
   └─ ○ telemetry&#91;.&#93;example [192.0.2&#91;.&#93;50] :443 tcp

systemd
└─ hosted-compute-agent
   └─ sudo
      └─ <strong>provjobd104857600</strong> <em>(pid 1902)</em>
         └─ ○ glb-2a3c35-public-internal.githubapp&#91;.&#93;com [140.82.113&#91;.&#93;9] :443 tcp <em>(github infra)</em>
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>cache.internal.example [192.0.2.40] :6379 tcp</code> | <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node (pid 4004)</code> | step: 3. Run api tests |
| <code>flap-b.example.com [198.51.100.61] :443 tcp</code> | <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node (pid 4003)</code> | step: 3. Run api tests |
| <code>kept.example.com [198.51.100.7] :443 tcp</code> | <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node (pid 4001)</code> | step: 3. Run api tests |
| <code>fresh.example.net [203.0.113.14] :443 tcp</code> | <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node (pid 4002)</code> | step: 3. Run api tests |
| <code>telemetry.example [192.0.2.50] :443 tcp</code> | <code>systemd</code> → <code>hosted-compute-agent (pid 1901)</code> | — |
| <code>glb-2a3c35-public-internal.githubapp.com [140.82.113.9] :443 tcp</code> | <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd104857600 (pid 1902)</code> | step: 99. Runner Processes · (github infra) |

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
| Workflow | ci |
| Job | steady |
| Repository | garnet-org/runtime-review-testbed |
| Commit | bb22cc33dd44ee55ff6677889900aabbccddee11 |
| Run | [32000000001](https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000001) |
| Coverage | recorded at the kernel by Garnet. Capture is best-effort. |
| Workload activity | 1&nbsp;execution chain · 1&nbsp;destination · 1&nbsp;destination association |
| Runner activity | 2&nbsp;execution chains · 2&nbsp;destinations · 2&nbsp;destination associations |
| Sensor network totals | network totals not recorded |
| Recorded at | 2026-08-07 12:00:00 UTC |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;4101</sub><br><sub>step: &quot;Install dependencies&quot;</sub> | <code>registry.npmjs&#91;.&#93;org</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> <sub>pid&nbsp;1912</sub> | <code>hosted-compute-watchdog-prod-iad-03.githubapp&#91;.&#93;com</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd209715200</code> <sub>pid&nbsp;1911</sub> | <code>glb-2a3c35-public-internal.githubapp&#91;.&#93;com</code> |

<details><summary><sub>Execution chains · 3&nbsp;destination associations</sub></summary>

<pre>
systemd
└─ Runner.Worker
   └─ bash
      └─ <strong>node</strong> <em>(pid 4101)</em> <em>(step: &quot;Install dependencies&quot;)</em>
         └─ ○ registry.npmjs&#91;.&#93;org [104.16.24&#91;.&#93;34] :443 tcp

systemd
└─ <strong>hosted-compute-agent</strong> <em>(pid 1912)</em>
   └─ ○ hosted-compute-watchdog-prod-iad-03.githubapp&#91;.&#93;com [140.82.115&#91;.&#93;40] :443 tcp <em>(github infra)</em>

systemd
└─ hosted-compute-agent
   └─ sudo
      └─ <strong>provjobd209715200</strong> <em>(pid 1911)</em>
         └─ ○ glb-2a3c35-public-internal.githubapp&#91;.&#93;com [140.82.114&#91;.&#93;30] :443 tcp <em>(github infra)</em>
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>registry.npmjs.org [104.16.24.34] :443 tcp</code> | <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node (pid 4101)</code> | step: 2. Install dependencies |
| <code>hosted-compute-watchdog-prod-iad-03.githubapp.com [140.82.115.40] :443 tcp</code> | <code>systemd</code> → <code>hosted-compute-agent (pid 1912)</code> | (github infra) |
| <code>glb-2a3c35-public-internal.githubapp.com [140.82.114.30] :443 tcp</code> | <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd209715200 (pid 1911)</code> | step: 99. Runner Processes · (github infra) |

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
| Workflow | ci |
| Job | warmup |
| Repository | garnet-org/runtime-review-testbed |
| Commit | bb22cc33dd44ee55ff6677889900aabbccddee11 |
| Run | [32000000001](https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000001) |
| Coverage | recorded at the kernel by Garnet. Capture is best-effort. |
| Workload activity | none recorded |
| Runner activity | 2&nbsp;execution chains · 2&nbsp;destinations · 2&nbsp;destination associations |
| Sensor network totals | network totals not recorded |
| Recorded at | 2026-08-07 12:00:00 UTC |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>hosted-compute-agent</code> <sub>pid&nbsp;1922</sub> | <code>hosted-compute-watchdog-prod-iad-02.githubapp&#91;.&#93;com</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd314572800</code> <sub>pid&nbsp;1921</sub> | <code>localhost</code> |

<details><summary><sub>Execution chains · 2&nbsp;destination associations</sub></summary>

<pre>
systemd
└─ <strong>hosted-compute-agent</strong> <em>(pid 1922)</em>
   └─ ○ hosted-compute-watchdog-prod-iad-02.githubapp&#91;.&#93;com [140.82.112&#91;.&#93;31] :443 tcp <em>(github infra)</em>

systemd
└─ hosted-compute-agent
   └─ sudo
      └─ <strong>provjobd314572800</strong> <em>(pid 1921)</em>
         └─ ○ localhost [127.0.0&#91;.&#93;53] :53 (dns) udp
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>hosted-compute-watchdog-prod-iad-02.githubapp.com [140.82.112.31] :443 tcp</code> | <code>systemd</code> → <code>hosted-compute-agent (pid 1922)</code> | (github infra) |
| <code>localhost [127.0.0.53] :53 (dns) udp</code> | <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd314572800 (pid 1921)</code> | step: 99. Runner Processes |

</details>

<details><summary><strong>Assertions</strong></summary>

No assertions recorded.

</details>

<div align="right">
<strong>Powered by Garnet</strong>
</div>
