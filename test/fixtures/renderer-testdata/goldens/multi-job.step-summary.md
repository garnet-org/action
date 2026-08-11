## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Profile | [019f5de7-59af-7208-a4f7-6cfecaae0c59](https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-59af-7208-a4f7-6cfecaae0c59&utm_source=github&utm_medium=step_summary) |
| Workflow | ci |
| Repository | garnet-org/runtime-review-testbed |
| Branch | refs/pull/76/merge |
| Pull request | [#76](https://github.com/garnet-org/runtime-review-testbed/pull/76) |
| Commit | 6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e |
| Triggered by | devin-ai-integration[bot] |
| Run ID / Job | 29294366437 / docs-build |
| Matrix job index | 2 |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;2384</sub> | · <code>registry.npmjs.org</code><br>· <code>localhost</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd920019609</code> <sub>pid&nbsp;1867</sub> | <code>localhost</code> |

<details><summary><sub>Full recorded tree</sub></summary>

<pre>
Runner.Worker
└─ bash
   └─ <strong>node</strong> <em>(step: &quot;Run workload&quot;)</em>
      ├─ ○ localhost <em>(dns resolver)</em>
      └─ ○ registry.npmjs.org
</pre>
</details>

Network telemetry observed 2 unique domains, 2 destinations, 2 connections, and 2 flows.

<div align="right">
<sub>2026-07-13 23:54:30 UTC</sub><br>
<a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-59af-7208-a4f7-6cfecaae0c59&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>

<sub><a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437">Job summary generated at run-time</a></sub>

---

## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Profile | [019f5de7-571c-78d6-8a61-dd43f61c441c](https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-571c-78d6-8a61-dd43f61c441c&utm_source=github&utm_medium=step_summary) |
| Workflow | ci |
| Repository | garnet-org/runtime-review-testbed |
| Branch | refs/pull/76/merge |
| Pull request | [#76](https://github.com/garnet-org/runtime-review-testbed/pull/76) |
| Commit | 6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e |
| Triggered by | devin-ai-integration[bot] |
| Run ID / Job | 29294366437 / install-only |
| Matrix job index | 1 |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>hosted-compute-agent</code> <sub>pid&nbsp;1878</sub> | <code>140.82.112.23</code> |
| <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;2371</sub> | · <code>registry.npmjs.org</code><br>· <code>localhost</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd1326539233</code> <sub>pid&nbsp;1893</sub> | · <code>localhost</code><br>· <code>hosted-compute-watchdog-prod-iad-01.githubapp</code> |

<details><summary><sub>Full recorded tree</sub></summary>

<pre>
systemd
└─ <strong>hosted-compute-agent</strong>
   ├─ sudo
   │  └─ <strong>provjobd</strong> <em>(ran from /tmp/…)</em>
   │     └─ ○ hosted-compute-watchdog-prod-iad-01.githubapp <em>(github infra)</em>
   └─ ○ 140.82.112.23

Runner.Worker
└─ bash
   └─ <strong>node</strong> <em>(step: &quot;Run workload&quot;)</em>
      ├─ ○ localhost <em>(dns resolver)</em>
      └─ ○ registry.npmjs.org
</pre>
</details>

Network telemetry observed 4 unique domains, 4 destinations, 4 connections, and 4 flows.

<div align="right">
<sub>2026-07-13 23:54:30 UTC</sub><br>
<a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-571c-78d6-8a61-dd43f61c441c&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>

<sub><a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437">Job summary generated at run-time</a></sub>

---

## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Profile | [019f5de7-54b9-704c-a002-a7d9d70b271b](https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-54b9-704c-a002-a7d9d70b271b&utm_source=github&utm_medium=step_summary) |
| Workflow | ci |
| Repository | garnet-org/runtime-review-testbed |
| Branch | refs/pull/76/merge |
| Pull request | [#76](https://github.com/garnet-org/runtime-review-testbed/pull/76) |
| Commit | 6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e |
| Triggered by | devin-ai-integration[bot] |
| Run ID / Job | 29294366437 / lint |
| Matrix job index | 3 |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>hosted-compute-agent</code> <sub>pid&nbsp;1854</sub> | <code>140.82.113.24</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd1278877480</code> <sub>pid&nbsp;1868</sub> | · <code>localhost</code><br>· <code>hosted-compute-watchdog-prod-iad-02.githubapp</code> |

<details><summary><sub>Full recorded tree</sub></summary>

<pre>
systemd
└─ <strong>hosted-compute-agent</strong>
   ├─ sudo
   │  └─ <strong>provjobd</strong> <em>(ran from /tmp/…)</em>
   │     ├─ ○ hosted-compute-watchdog-prod-iad-02.githubapp <em>(github infra)</em>
   │     └─ ○ localhost <em>(dns resolver)</em>
   └─ ○ 140.82.113.24
</pre>
</details>

Network telemetry observed 3 unique domains, 3 destinations, 3 connections, and 3 flows.

<div align="right">
<sub>2026-07-13 23:54:29 UTC</sub><br>
<a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-54b9-704c-a002-a7d9d70b271b&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>

<sub><a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437">Job summary generated at run-time</a></sub>

---

## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Profile | [019f5de7-5ca7-7f9d-bfb3-c59ccde51111](https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-5ca7-7f9d-bfb3-c59ccde51111&utm_source=github&utm_medium=step_summary) |
| Workflow | ci |
| Repository | garnet-org/runtime-review-testbed |
| Branch | refs/pull/76/merge |
| Pull request | [#76](https://github.com/garnet-org/runtime-review-testbed/pull/76) |
| Commit | 6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e |
| Triggered by | devin-ai-integration[bot] |
| Run ID / Job | 29294366437 / typecheck |
| Matrix job index | 4 |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>hosted-compute-agent</code> <sub>pid&nbsp;1878</sub> | <code>140.82.114.24</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd3832655626</code> <sub>pid&nbsp;1893</sub> | · <code>localhost</code><br>· <code>hosted-compute-watchdog-prod-iad-02.githubapp</code> |

<details><summary><sub>Full recorded tree</sub></summary>

<pre>
systemd
└─ <strong>hosted-compute-agent</strong>
   ├─ sudo
   │  └─ <strong>provjobd</strong> <em>(ran from /tmp/…)</em>
   │     ├─ ○ hosted-compute-watchdog-prod-iad-02.githubapp <em>(github infra)</em>
   │     └─ ○ localhost <em>(dns resolver)</em>
   └─ ○ 140.82.114.24
</pre>
</details>

Network telemetry observed 3 unique domains, 3 destinations, 3 connections, and 3 flows.

<div align="right">
<sub>2026-07-13 23:54:31 UTC</sub><br>
<a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-5ca7-7f9d-bfb3-c59ccde51111&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>

<sub><a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437">Job summary generated at run-time</a></sub>

---

## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Profile | [019f5de7-5992-7409-89cf-6d88e0fb46ea](https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-5992-7409-89cf-6d88e0fb46ea&utm_source=github&utm_medium=step_summary) |
| Workflow | ci |
| Repository | garnet-org/runtime-review-testbed |
| Branch | refs/pull/76/merge |
| Pull request | [#76](https://github.com/garnet-org/runtime-review-testbed/pull/76) |
| Commit | 6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e |
| Triggered by | devin-ai-integration[bot] |
| Run ID / Job | 29294366437 / workload-egress |
| Matrix job index | 0 |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>hosted-compute-agent</code> <sub>pid&nbsp;1849</sub> | <code>140.82.113.23</code> |
| <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;2361</sub> | · <code>registry.npmjs.org</code><br>· <code>localhost</code> |
| <code>systemd</code> → <code>…</code> → <code>node</code> → <code>dash</code> → <code>node</code> <sub>pid&nbsp;2384</sub> | · <code>registry.npmjs.org</code><br>· <code>api.garnet.ai</code><br>· <code>localhost</code><br>· <code>github.com</code> |
| <code>systemd</code> → <code>…</code> → <code>node</code> → <code>dash</code> → <code>curl</code> <sub>pid&nbsp;2396</sub> | · <code>httpbin.org</code><br>· <code>localhost</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd811584691</code> <sub>pid&nbsp;1864</sub> | · <code>localhost</code><br>· <code>hosted-compute-watchdog-prod-iad-02.githubapp</code> |

<details><summary><sub>Full recorded tree</sub></summary>

<pre>
systemd
└─ <strong>hosted-compute-agent</strong>
   ├─ sudo
   │  └─ <strong>provjobd</strong> <em>(ran from /tmp/…)</em>
   │     └─ ○ hosted-compute-watchdog-prod-iad-02.githubapp <em>(github infra)</em>
   └─ ○ 140.82.113.23

Runner.Worker
└─ bash
   └─ <strong>node</strong> <em>(step: &quot;Run workload&quot;)</em>
      ├─ dash
      │  └─ <strong>node</strong>
      │     ├─ dash
      │     │  └─ <strong>curl</strong>
      │     │     └─ ○ httpbin.org
      │     ├─ ○ api.garnet.ai <em>(garnet sensor)</em>
      │     └─ ○ github.com
      ├─ ○ localhost <em>(dns resolver)</em>
      └─ ○ registry.npmjs.org
</pre>
</details>

Network telemetry observed 7 unique domains, 8 destinations, 8 connections, and 8 flows.

<div align="right">
<sub>2026-07-13 23:54:30 UTC</sub><br>
<a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-5992-7409-89cf-6d88e0fb46ea&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>

<sub><a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437">Job summary generated at run-time</a></sub>
