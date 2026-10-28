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
