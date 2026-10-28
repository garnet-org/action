<!-- 1. PR comment — reference-renderer projection -->

<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit 786a5bc8680486720bcf5dae13931de95d89b5ec -->
<!-- garnet:summary {"contract":"6.10.0","githubMeta":"2026-08-08","commit":"786a5bc8680486720bcf5dae13931de95d89b5ec","previous":null,"jobs":1,"changed":null,"unchanged":null,"noOutbound":null,"vanished":null,"added":null,"removed":null,"backgroundAdded":null,"backgroundRemoved":null,"vanishedDestinations":null,"chains":1,"destinations":1,"recorded":null,"kinds":["network"]} -->
### Runtime behavior recorded

<sub>*head* [`786a5bc`](https://github.com/garnet-org/runtime-review-testbed/commit/786a5bc8680486720bcf5dae13931de95d89b5ec)</sub>

> *1&nbsp;destination*
> <sub>recorded at the kernel by Garnet</sub>

<details><summary><code>Garnet Runtime Review</code> / <a href="https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28488074733"><code>runtime-review</code>&nbsp;↗</a> · 1&nbsp;destination</summary>

<pre>
Runner.Worker
└─ bash
   └─ <strong>npm install</strong>
      └─ ○ registry.npmjs[.]org
</pre>

<sub><a href="https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28488074733">Job log</a> · <a href="https://app.garnet.ai/public/runs/28488074733?profile=019f1b61-9f3c-7ac8-a8ed-0c07bf1546af&amp;utm_source=github&amp;utm_medium=pr_comment">Full record in Garnet ↗</a></sub>

</details>

---

<details><summary><sub>How to read this</sub></summary>

<pre>
Runner.Worker          <em>← process on a path</em>
└─ npm
   └─ <strong>node</strong>             <em>← process that acted</em>
      └─ ○ npmjs[.]org <em>← observed action</em>
</pre>

<sub><i>follow a path downward to see what ran and what it did — each path to an observed action is an execution chain · Capture is best-effort.</i></sub>

<sub><i>names on the path = processes · ○ = observed action · (…) = context</i></sub>

</details>

<sub>Runtime behavior, recorded by Garnet. <a href="https://app.garnet.ai/onboarding?utm_source=github&amp;utm_medium=pr_comment&amp;utm_campaign=garnet-org-runtime-review-testbed-pr22&amp;utm_content=add_to_ci">Add it to your CI ↗</a></sub>

---

<!-- 2. Step Summary — written to GITHUB_STEP_SUMMARY -->

## Garnet Execution Summary

### Workload context

| Field | Value |
| --- | --- |
| Profile | [019f1b61-9f3c-7ac8-a8ed-0c07bf1546af](https://app.garnet.ai/public/runs/28488074733?profile=019f1b61-9f3c-7ac8-a8ed-0c07bf1546af&utm_source=github&utm_medium=step_summary) |
| Workflow | Garnet Runtime Review |
| Job | runtime-review |
| Repository | garnet-labs/runtime-review-testbed |
| Branch | refs/pull/22/merge |
| Pull request | [#22](https://github.com/garnet-labs/runtime-review-testbed/pull/22) |
| Commit | 786a5bc8680486720bcf5dae13931de95d89b5ec |
| Triggered by | devin-ai-integration&#91;bot&#93; |
| Run | [28488074733](https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28488074733) |
| Coverage | recorded at the kernel by Garnet. Capture is best-effort. |
| Workload activity | 1&nbsp;execution chain · 1&nbsp;destination · 1&nbsp;destination association |
| Runner activity | none recorded |
| Sensor network totals | 1&nbsp;unique domain · 15&nbsp;connections |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>npm install</code> | <code>registry.npmjs&#91;.&#93;org</code> |

<details><summary><sub>Execution chains · 1&nbsp;destination association</sub></summary>

<pre>
systemd
└─ hosted-compute-agent
   └─ Runner.Listener
      └─ Runner.Worker
         └─ bash
            └─ <strong>npm install</strong>
               └─ ○ registry.npmjs&#91;.&#93;org [104.16.5&#91;.&#93;34] :443
</pre>
</details>

<div align="right">
<a href="https://app.garnet.ai/public/runs/28488074733?profile=019f1b61-9f3c-7ac8-a8ed-0c07bf1546af&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>
