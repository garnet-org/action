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

<div align="right">
<sub>2026-08-07 12:00:00 UTC</sub><br>
<strong>Powered by Garnet</strong>
</div>

<sub><a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000001">Job summary generated at run-time</a></sub>
