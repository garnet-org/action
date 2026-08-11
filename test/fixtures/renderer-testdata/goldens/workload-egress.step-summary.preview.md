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

<sub><a href="https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28492112239">Job summary generated at run-time</a></sub>
