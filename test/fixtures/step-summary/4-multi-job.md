### Garnet Runtime Summary

#### Workload Summary

| Field | Value |
| --- | --- |
| Workflow | Garnet Runtime Review |
| Repository | garnet-labs/runtime-review-testbed |
| Branch | refs/pull/22/merge |
| Commit | f49a8476ccfe33c72428d0c471093a1c84f40124 |
| Triggered by | devin-ai-integration[bot] |
| Run ID / Job | 28488074733 / runtime-review |

#### Network Egress Summary

Destinations are grouped by lineage tree.

| Lineage Tree | Destinations |
| --- | --- |
| `systemd` → `...` → `Runner.Worker` → `bash` → `node` <sub>pid 2377</sub> | `registry.npmjs.org` (104.16.5.34), `localhost` (127.0.0.53) |

Network telemetry observed 2 unique domains, 2 destinations, and 2 connections.

<details><summary><strong>Assertions</strong> · beta</summary>

| Class | Check | Result | Evidence |
| --- | --- | --- | --- |
| Network Egress | A process contacted an unexpected network domain. | 🟡 `ATTENTION` | 2 events |
| Stealth | A program was executed, and then its file was deleted. | ✅ `PASS` | 0 events |
| Privilege Escalation | A process initiated code injection via `/proc/{pid}/mem` access. | ✅ `PASS` | 0 events |

<details><summary>Evidence · A process contacted an unexpected network domain.</summary>

| Event Type | Destination | Remote Address | Process | Command |
| --- | --- | --- | --- | --- |
| `exec_from_unusual_dir` | `registry.npmjs.org` | `104.16.5.34` | `node` | `node /opt/hostedtoolcache/node/20.20.2/x64/bin/npm install` |
| `flow` | `registry.npmjs.org` | `104.16.5.34` | `node` | `node /opt/hostedtoolcache/node/20.20.2/x64/bin/npm install` |

</details>

</details>

<div align="right"><sub>2 unique domains · 2 connections · workflow Garnet Runtime Review · run #28488074733 · job runtime-review · 2026-07-01 01:53:29 UTC</sub><br><b>Powered by Garnet</b> · <a href="https://app.garnet.ai/public/runs/28488074733?utm_source=github&amp;utm_medium=pr_comment">View Run Profile in Garnet ↗</a></div>

---

### Garnet Runtime Summary

#### Workload Summary

| Field | Value |
| --- | --- |
| Workflow | Garnet Runtime Review |
| Repository | garnet-labs/runtime-review-testbed |
| Branch | refs/pull/22/merge |
| Commit | ef01a52517e7532ab34aadea58b952c9f1e79ece |
| Triggered by | devin-ai-integration[bot] |
| Run ID / Job | 28492112239 / runtime-review |

#### Network Egress Summary

Destinations are grouped by lineage tree.

| Lineage Tree | Destinations |
| --- | --- |
| `systemd` → `...` → `npm test` → `sh` → `node` | `api.garnet.ai` (104.26.11.16), `images.unsplash.com` (146.75.94.208), `dualstack.com.imgix.map.fastly.net` (146.75.94.208), `unsplash.imgix.net` (146.75.94.208), `registry.npmjs.org` (104.16.8.34), `github.com` (140.82.113.3) |
| `systemd` → `...` → `Runner.Worker` → `bash` → `npm install` | `registry.npmjs.org` (104.16.8.34) |

Network telemetry observed 4 unique domains, 6 destinations, and 19 connections.

<details><summary><strong>Assertions</strong> · beta</summary>

No assertions information available.

</details>

<div align="right"><sub>4 unique domains · 19 connections · workflow Garnet Runtime Review · run #28492112239 · job runtime-review</sub><br><b>Powered by Garnet</b> · <a href="https://app.garnet.ai/public/runs/28492112239?utm_source=github&amp;utm_medium=pr_comment">View Run Profile in Garnet ↗</a></div>
