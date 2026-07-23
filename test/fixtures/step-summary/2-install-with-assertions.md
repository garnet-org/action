### Garnet Runtime Summary

#### Workload Summary

| Field | Value |
| --- | --- |
| Garnet Profile UUID | 65d9cef6-5dd0-5606-9453-b7113126034c |
| Workflow | Garnet Runtime Review |
| Repository | garnet-labs/runtime-review-testbed |
| Branch | refs/pull/22/merge |
| Commit | f49a8476ccfe33c72428d0c471093a1c84f40124 |
| Triggered by | devin-ai-integration[bot] |
| Run ID / Job | 28488074733 / runtime-review |

#### Network Egress Summary

One row per recorded destination, in the profile's own order.

| Destination | Process Tree |
| --- | --- |
| `registry.npmjs.org` | `systemd` → `...` → `Runner.Worker` → `bash` → `node` `(pid 2377)` |
| `localhost` | `systemd` → `...` → `Runner.Worker` → `bash` → `node` `(pid 2377)` |

Network telemetry observed 2 unique domains, 2 destinations, 2 connections, and 2 flows.

<details><summary><strong>Assertions</strong></summary>

| Class | Assertion | Check | Result | Evidence |
| --- | --- | --- | --- | --- |
| Network Egress | `no_bad_egress_domain` | A process contacted an unexpected network domain. | 🟡 `ATTENTION` | 2 events |
| Stealth | `no_binary_execution_and_deletion` | A program was executed, and then its file was deleted. | ✅ `PASS` | 0 events |
| Privilege Escalation | `no_code_injection_via_proc_memory` | A process initiated code injection via `/proc/{pid}/mem` access. | ✅ `PASS` | 0 events |

<details><summary>Evidence · <code>no_bad_egress_domain</code></summary>

| Event Type | Destination | Remote Address | Process | Command | Step |
| --- | --- | --- | --- | --- | --- |
| `exec_from_unusual_dir` | `registry.npmjs.org` | `104.16.5.34` | `node` | `node /opt/hostedtoolcache/node/20.20.2/x64/bin/npm install` | 3. Install dependencies |
| `flow` | `registry.npmjs.org` | `104.16.5.34` | `node` | `node /opt/hostedtoolcache/node/20.20.2/x64/bin/npm install` | 3. Install dependencies |

</details>

</details>

<div align="right"><sub>2 unique domains · 2 connections · workflow Garnet Runtime Review · run #28488074733 · job runtime-review · 2026-07-01 01:53:29 UTC</sub><br><b>Powered by Garnet</b> · <a href="https://app.garnet.ai/public/runs/28488074733?job=runtime-review&amp;utm_source=github&amp;utm_medium=action_summary">View Run Profile in Garnet ↗</a></div>
