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

One row per recorded destination, in the profile's own order.

| Destination | Process Tree |
| --- | --- |
| `api.garnet.ai` | `systemd` → `...` → `npm test` → `sh` → `node` |
| `images.unsplash.com` | `systemd` → `...` → `npm test` → `sh` → `node` |
| `dualstack.com.imgix.map.fastly.net` | `systemd` → `...` → `npm test` → `sh` → `node` |
| `unsplash.imgix.net` | `systemd` → `...` → `npm test` → `sh` → `node` |
| `registry.npmjs.org` | `systemd` → `...` → `npm test` → `sh` → `node`<br>`systemd` → `...` → `Runner.Worker` → `bash` → `npm install` |
| `github.com` | `systemd` → `...` → `npm test` → `sh` → `node` |

Network telemetry observed 4 unique domains, 6 destinations, 19 connections, and 4 flows.

<div align="right"><sub>4 unique domains · 19 connections · workflow Garnet Runtime Review · run #28492112239 · job runtime-review</sub><br><b>Powered by Garnet</b> · <a href="https://app.garnet.ai/public/runs/28492112239?job=runtime-review&amp;utm_source=github&amp;utm_medium=action_summary">View Run Profile in Garnet ↗</a></div>
