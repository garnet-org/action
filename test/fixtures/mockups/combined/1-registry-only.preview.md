<!-- 1. PR comment — reference-renderer projection -->

<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit 786a5bc8680486720bcf5dae13931de95d89b5ec -->
<!-- garnet:summary {"contract":"6.9.8","commit":"786a5bc8680486720bcf5dae13931de95d89b5ec","previous":null,"jobs":1,"changed":null,"unchanged":null,"noOutbound":null,"vanished":null,"added":null,"removed":null,"vanishedDestinations":null,"chains":1,"destinations":1,"kinds":["network"]} -->
**Execution Profiles recorded for 1 job, triggered by [`786a5bc`](https://github.com/garnet-org/runtime-review-testbed/commit/786a5bc8680486720bcf5dae13931de95d89b5ec)**

> *1&nbsp;destination*
> <sub>recorded at the kernel by Garnet</sub>

<details><summary><code>Garnet Runtime Review</code> / <a href="https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28488074733"><code>runtime-review</code>&nbsp;↗</a> · 1&nbsp;destination</summary>

<pre>
Runner.Worker
└─ bash
   └─ <strong>npm install</strong>
      └─ ○ registry.npmjs[.]org
</pre>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/28488074733?profile=019f1b61-9f3c-7ac8-a8ed-0c07bf1546af&amp;utm_source=github&amp;utm_medium=pr_comment">View this job's Execution Profile in Garnet →</a></sub></p>

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
| Profile | [019f1b61-9f3c-7ac8-a8ed-0c07bf1546af](https://app.garnet.ai/public/runs/28488074733?profile=019f1b61-9f3c-7ac8-a8ed-0c07bf1546af&utm_source=github&utm_medium=step_summary) |
| Workflow | Garnet Runtime Review |
| Repository | garnet-labs/runtime-review-testbed |
| Branch | refs/pull/22/merge |
| Pull request | [#22](https://github.com/garnet-labs/runtime-review-testbed/pull/22) |
| Commit | 786a5bc8680486720bcf5dae13931de95d89b5ec |
| Triggered by | devin-ai-integration[bot] |
| Run ID / Job | 28488074733 / runtime-review |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>npm install</code> | <code>registry.npmjs.org</code> |

<details><summary><sub>Full recorded tree</sub></summary>

<pre>
Runner.Worker
└─ bash
   └─ <strong>npm install</strong>
      └─ ○ registry.npmjs.org
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>registry.npmjs.org [104.16.5.34] :443</code> | <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>npm install</code> | — |

</details>

<details><summary><strong>Assertions</strong></summary>

No assertions recorded.

</details>

<div align="right">
<a href="https://app.garnet.ai/public/runs/28488074733?profile=019f1b61-9f3c-7ac8-a8ed-0c07bf1546af&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>

<sub><a href="https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28488074733">Job summary generated at run-time</a></sub>
