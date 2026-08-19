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
