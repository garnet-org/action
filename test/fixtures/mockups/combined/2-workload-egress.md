<!-- 1. PR comment — reference-renderer projection -->

<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit ef01a52517e7532ab34aadea58b952c9f1e79ece -->
<!-- garnet:summary {"contract":"6.6.1","commit":"ef01a52517e7532ab34aadea58b952c9f1e79ece","previous":null,"jobs":1,"changed":null,"unchanged":null,"noOutbound":null,"vanished":null,"added":null,"removed":null,"vanishedChains":null,"chains":4,"destinations":4} -->
**Execution Profiles recorded for 1 job, triggered by [`ef01a52`](https://github.com/garnet-org/runtime-review-testbed/commit/ef01a52517e7532ab34aadea58b952c9f1e79ece)**

> *4&nbsp;execution chains · 4&nbsp;destinations · recorded at the kernel by Garnet*

<details><summary><code>Garnet Runtime Review</code> / <a href="https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28492112239"><code>runtime-review</code>&nbsp;↗</a></summary>

<details><summary><sub>dns + runner substrate · 4&nbsp;chains</sub></summary>

<pre>
<em>Runner.Worker</em>
└─ <em>bash</em>
   ├─ <em>npm test</em>
   │  └─ <em>sh</em>
   │     └─ <em>node</em>
   │        ├─ → api.garnet[.]ai
   │        ├─ → github[.]com
   │        └─ → images.unsplash[.]com
   └─ <em>npm install</em>
      └─ → registry.npmjs[.]org
</pre>

</details>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/28492112239?profile=019f1bca-e403-7ef6-ae2d-74c191dbff8e&amp;utm_source=github&amp;utm_medium=pr_comment">View this job's Execution Profile in Garnet →</a></sub></p>

</details>

---

<details><summary><sub>💡 How to read this</sub></summary>

<pre>
<em>Runner.Worker</em>                ← the runner: root of the job's execution tree (italic)
└─ <strong>npm install</strong>               ← a process your job ran (bold)
   └─ → registry.npmjs[.]org  ← an action: what the process did — an outbound connection, defanged
      ╰ one chain of processes, root to action: an execution chain
</pre>

<sub><i>The tree is every chain the job ran; a process appears only when it acted.</i></sub>

</details>

---

<!-- 2. Step Summary — written to GITHUB_STEP_SUMMARY -->

## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Profile UUID | 019f1bca-e403-7ef6-ae2d-74c191dbff8e |
| Workflow | Garnet Runtime Review |
| Repository | garnet-labs/runtime-review-testbed |
| Branch | refs/pull/22/merge |
| Commit | ef01a52517e7532ab34aadea58b952c9f1e79ece |
| Triggered by | devin-ai-integration[bot] |
| Run ID / Job | 28492112239 / runtime-review |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>npm install</code> | <code>registry.npmjs.org</code> |
| <code>systemd</code> → <code>…</code> → <code>npm test</code> → <code>sh</code> → <code>node</code> | · <code>registry.npmjs.org</code><br>· <code>api.garnet.ai</code><br>· <code>github.com</code><br>· <code>images.unsplash.com</code> |

<div align="right">
<a href="https://app.garnet.ai/public/runs/28492112239?profile=019f1bca-e403-7ef6-ae2d-74c191dbff8e&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>

<sub><a href="https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28492112239">Job summary generated at run-time</a></sub>
