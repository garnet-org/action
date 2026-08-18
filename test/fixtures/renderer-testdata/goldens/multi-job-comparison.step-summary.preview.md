## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Workflow | ci |
| Repository | garnet-org/runtime-review-testbed |
| Commit | bb22cc33dd44ee55ff6677889900aabbccddee11 |
| Run ID / Job | 32000000001 / api |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;4004</sub> | <code>cache.internal.example</code> |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;4003</sub> | <code>flap-b.example.com</code> |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;4001</sub> | <code>kept.example.com</code> |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;4002</sub> | <code>fresh.example.net</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> <sub>pid&nbsp;1901</sub> | <code>telemetry.example</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd104857600</code> <sub>pid&nbsp;1902</sub> | <code>glb-2a3c35-public-internal.githubapp.com</code> |

<details><summary><sub>Full recorded tree</sub></summary>

<pre>
Runner.Worker
└─ bash
   └─ <strong>node</strong> <em>(step: &quot;Run api tests&quot;)</em>
      ├─ ○ cache.internal.example
      ├─ ○ flap-b.example.com
      ├─ ○ fresh.example.net
      └─ ○ kept.example.com

systemd
└─ <strong>hosted-compute-agent</strong>
   ├─ sudo
   │  └─ <strong>provjobd</strong>
   │     └─ ○ glb-2a3c35-public-internal.githubapp.com <em>(github infra)</em>
   └─ ○ telemetry.example
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
<sub>2026-08-07 12:00:00 UTC</sub><br>
<strong>Powered by Garnet</strong>
</div>

<sub><a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000001">Job summary generated at run-time</a></sub>

---

## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Workflow | ci |
| Repository | garnet-org/runtime-review-testbed |
| Commit | bb22cc33dd44ee55ff6677889900aabbccddee11 |
| Run ID / Job | 32000000001 / steady |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;4101</sub> | <code>registry.npmjs.org</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> <sub>pid&nbsp;1912</sub> | <code>hosted-compute-watchdog-prod-iad-03.githubapp.com</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd209715200</code> <sub>pid&nbsp;1911</sub> | <code>glb-2a3c35-public-internal.githubapp.com</code> |

<details><summary><sub>Full recorded tree</sub></summary>

<pre>
Runner.Worker
└─ bash
   └─ <strong>node</strong> <em>(step: &quot;Install dependencies&quot;)</em>
      └─ ○ registry.npmjs.org

systemd
└─ <strong>hosted-compute-agent</strong>
   ├─ sudo
   │  └─ <strong>provjobd</strong>
   │     └─ ○ glb-2a3c35-public-internal.githubapp.com <em>(github infra)</em>
   └─ ○ hosted-compute-watchdog-prod-iad-03.githubapp.com <em>(github infra)</em>
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
<sub>2026-08-07 12:00:00 UTC</sub><br>
<strong>Powered by Garnet</strong>
</div>

<sub><a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000001">Job summary generated at run-time</a></sub>

---

## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Workflow | ci |
| Repository | garnet-org/runtime-review-testbed |
| Commit | bb22cc33dd44ee55ff6677889900aabbccddee11 |
| Run ID / Job | 32000000001 / warmup |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>hosted-compute-agent</code> <sub>pid&nbsp;1922</sub> | <code>hosted-compute-watchdog-prod-iad-02.githubapp.com</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd314572800</code> <sub>pid&nbsp;1921</sub> | <code>localhost</code> |

<details><summary><sub>Full recorded tree</sub></summary>

<pre>
systemd
└─ <strong>hosted-compute-agent</strong>
   ├─ sudo
   │  └─ <strong>provjobd</strong>
   │     └─ ○ localhost <em>(dns resolver)</em>
   └─ ○ hosted-compute-watchdog-prod-iad-02.githubapp.com <em>(github infra)</em>
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>hosted-compute-watchdog-prod-iad-02.githubapp.com [140.82.112.31] :443 tcp</code> | <code>systemd</code> → <code>hosted-compute-agent (pid 1922)</code> | (github infra) |
| <code>localhost [127.0.0.53] :53 (dns) udp</code> | <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd314572800 (pid 1921)</code> | step: 99. Runner Processes · (dns resolver) |

</details>

<details><summary><strong>Assertions</strong></summary>

No assertions recorded.

</details>

<div align="right">
<sub>2026-08-07 12:00:00 UTC</sub><br>
<strong>Powered by Garnet</strong>
</div>

<sub><a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000001">Job summary generated at run-time</a></sub>
