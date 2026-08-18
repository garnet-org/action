<!-- 1. PR comment — reference-renderer projection -->

<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit ef01a52517e7532ab34aadea58b952c9f1e79ece -->
<!-- garnet:summary {"contract":"6.10.0","commit":"ef01a52517e7532ab34aadea58b952c9f1e79ece","previous":null,"jobs":1,"changed":null,"unchanged":null,"noOutbound":null,"vanished":null,"added":null,"removed":null,"backgroundAdded":null,"backgroundRemoved":null,"vanishedDestinations":null,"chains":5,"destinations":4,"kinds":["network"]} -->
**Execution Profiles recorded for 1 job, triggered by [`ef01a52`](https://github.com/garnet-org/runtime-review-testbed/commit/ef01a52517e7532ab34aadea58b952c9f1e79ece)**

> *4&nbsp;destinations*
> <sub>recorded at the kernel by Garnet</sub>

<details><summary><code>Garnet Runtime Review</code> / <a href="https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28492112239"><code>runtime-review</code>&nbsp;↗</a> · 4&nbsp;destinations</summary>

<pre>
Runner.Worker
└─ bash
   ├─ npm test
   │  └─ sh
   │     └─ <strong>node</strong>
   │        ├─ ○ api.garnet[.]ai <em>(garnet sensor)</em>
   │        ├─ ○ github[.]com
   │        └─ ○ images.unsplash[.]com
   └─ <strong>npm install</strong>
      └─ ○ registry.npmjs[.]org
</pre>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/28492112239?profile=019f1bca-e403-7ef6-ae2d-74c191dbff8e&amp;utm_source=github&amp;utm_medium=pr_comment">View this job's Execution Profile in Garnet →</a></sub></p>

</details>

---

<details><summary><sub>💡 How to read this</sub></summary>

<pre>
Runner.Worker          <em>← process on a path</em>
└─ npm
   └─ <strong>node</strong>             <em>← process that acted</em>
      └─ ○ npmjs[.]org <em>← observed action</em>
</pre>

<sub><i>follow a path downward to see what ran and what it did — each path to an observed action is an execution chain</i></sub>

<sub><i>names on the path = processes · ○ = observed action · (…) = context</i></sub>

</details>

---

<!-- 2. Step Summary — written to GITHUB_STEP_SUMMARY -->

## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Profile | [019f1bca-e403-7ef6-ae2d-74c191dbff8e](https://app.garnet.ai/public/runs/28492112239?profile=019f1bca-e403-7ef6-ae2d-74c191dbff8e&utm_source=github&utm_medium=step_summary) |
| Workflow | Garnet Runtime Review |
| Repository | garnet-labs/runtime-review-testbed |
| Branch | refs/pull/22/merge |
| Pull request | [#22](https://github.com/garnet-labs/runtime-review-testbed/pull/22) |
| Commit | ef01a52517e7532ab34aadea58b952c9f1e79ece |
| Triggered by | devin-ai-integration[bot] |
| Run ID / Job | 28492112239 / runtime-review |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>npm install</code> | <code>registry.npmjs.org</code> |
| <code>systemd</code> → <code>…</code> → <code>npm test</code> → <code>sh</code> → <code>node</code> | · <code>registry.npmjs.org</code><br>· <code>api.garnet.ai</code><br>· <code>github.com</code><br>· <code>images.unsplash.com</code> |

<details><summary><sub>Full recorded tree</sub></summary>

<pre>
Runner.Worker
└─ bash
   ├─ npm test
   │  └─ sh
   │     └─ <strong>node</strong>
   │        ├─ ○ api.garnet.ai <em>(garnet sensor)</em>
   │        ├─ ○ github.com
   │        └─ ○ images.unsplash.com
   └─ <strong>npm install</strong>
      └─ ○ registry.npmjs.org
</pre>
</details>

<div align="right">
<a href="https://app.garnet.ai/public/runs/28492112239?profile=019f1bca-e403-7ef6-ae2d-74c191dbff8e&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>

<sub><a href="https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28492112239">Job summary generated at run-time</a></sub>
