<!-- 1. PR comment — reference-renderer projection -->

<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit ef01a52517e7532ab34aadea58b952c9f1e79ece -->
<!-- garnet:summary {"contract":"6.10.0","githubMeta":"2026-08-08","commit":"ef01a52517e7532ab34aadea58b952c9f1e79ece","previous":null,"jobs":1,"changed":null,"unchanged":null,"noOutbound":null,"vanished":null,"added":null,"removed":null,"backgroundAdded":null,"backgroundRemoved":null,"vanishedDestinations":null,"chains":5,"destinations":4,"recorded":null,"kinds":["network"]} -->
### Runtime behavior recorded

<sub>*head* [`ef01a52`](https://github.com/garnet-org/runtime-review-testbed/commit/ef01a52517e7532ab34aadea58b952c9f1e79ece)</sub>

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

<sub><a href="https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28492112239">Job log</a> · <a href="https://app.garnet.ai/public/runs/28492112239?profile=019f1bca-e403-7ef6-ae2d-74c191dbff8e&amp;utm_source=github&amp;utm_medium=pr_comment">Full record in Garnet ↗</a></sub>

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
| Profile | [019f1bca-e403-7ef6-ae2d-74c191dbff8e](https://app.garnet.ai/public/runs/28492112239?profile=019f1bca-e403-7ef6-ae2d-74c191dbff8e&utm_source=github&utm_medium=step_summary) |
| Workflow | Garnet Runtime Review |
| Job | runtime-review |
| Repository | garnet-labs/runtime-review-testbed |
| Branch | refs/pull/22/merge |
| Pull request | [#22](https://github.com/garnet-labs/runtime-review-testbed/pull/22) |
| Commit | ef01a52517e7532ab34aadea58b952c9f1e79ece |
| Triggered by | devin-ai-integration&#91;bot&#93; |
| Run | [28492112239](https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28492112239) |
| Coverage | recorded at the kernel by Garnet. Capture is best-effort. |
| Workload activity | 2&nbsp;execution chains · 4&nbsp;destinations · 5&nbsp;destination associations |
| Runner activity | none recorded |
| Sensor network totals | 4&nbsp;unique domains · 19&nbsp;connections |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>npm install</code> | <code>registry.npmjs&#91;.&#93;org</code> |
| <code>systemd</code> → <code>…</code> → <code>npm test</code> → <code>sh</code> → <code>node</code> | · <code>registry.npmjs&#91;.&#93;org</code><br>· <code>api.garnet&#91;.&#93;ai</code><br>· <code>github&#91;.&#93;com</code><br>· <code>images.unsplash&#91;.&#93;com</code> |

<details><summary><sub>Execution chains · 5&nbsp;destination associations</sub></summary>

<pre>
systemd
└─ hosted-compute-agent
   └─ Runner.Listener
      └─ Runner.Worker
         └─ bash
            └─ <strong>npm install</strong>
               └─ ○ registry.npmjs&#91;.&#93;org [104.16.8&#91;.&#93;34] :443

systemd
└─ hosted-compute-agent
   └─ Runner.Listener
      └─ Runner.Worker
         └─ bash
            └─ npm test
               └─ sh
                  └─ <strong>node</strong>
                     ├─ ○ registry.npmjs&#91;.&#93;org [104.16.8&#91;.&#93;34] :443
                     ├─ ○ api.garnet&#91;.&#93;ai [104.26.11&#91;.&#93;16] :443 <em>(garnet sensor)</em>
                     ├─ ○ github&#91;.&#93;com [140.82.113&#91;.&#93;3] :443
                     └─ ○ images.unsplash&#91;.&#93;com [146.75.94&#91;.&#93;208] :443 · also recorded: dualstack.com.imgix.map.fastly&#91;.&#93;net, unsplash.imgix&#91;.&#93;net
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>registry.npmjs.org [104.16.8.34] :443</code> | <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>npm install</code> | — |
| <code>registry.npmjs.org [104.16.8.34] :443</code> | <code>systemd</code> → <code>…</code> → <code>npm test</code> → <code>sh</code> → <code>node</code> | — |
| <code>api.garnet.ai [104.26.11.16] :443</code> | <code>systemd</code> → <code>…</code> → <code>npm test</code> → <code>sh</code> → <code>node</code> | (garnet sensor) |
| <code>github.com [140.82.113.3] :443</code> | <code>systemd</code> → <code>…</code> → <code>npm test</code> → <code>sh</code> → <code>node</code> | — |
| <code>images.unsplash.com [146.75.94.208] :443 · also recorded: dualstack.com.imgix.map.fastly.net, unsplash.imgix.net</code> | <code>systemd</code> → <code>…</code> → <code>npm test</code> → <code>sh</code> → <code>node</code> | — |

</details>

<details><summary><strong>Assertions</strong></summary>

No assertions recorded.

</details>

<div align="right">
<a href="https://app.garnet.ai/public/runs/28492112239?profile=019f1bca-e403-7ef6-ae2d-74c191dbff8e&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>
