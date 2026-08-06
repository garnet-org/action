<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit 6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e -->
<!-- garnet:summary {"contract":"6.6.1","commit":"6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e","previous":null,"jobs":5,"changed":null,"unchanged":null,"noOutbound":null,"vanished":null,"added":null,"removed":null,"vanishedChains":null,"chains":19,"destinations":11} -->
**Execution Profiles recorded for 5 jobs, triggered by [`6e5d0d4`](https://github.com/garnet-org/runtime-review-testbed/commit/6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e)**

> *19&nbsp;execution chains · 11&nbsp;destinations · recorded at the kernel by Garnet · 2026-07-13 23:54:31 UTC*

<details><summary><code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437"><code>docs-build</code>&nbsp;↗</a> · Run workload reached 1 destination</summary>

<pre>
<em>Runner.Worker</em>
└─ <strong>bash</strong>
   └─ <strong>node</strong>
      └─ → registry.npmjs[.]org
</pre>

<details><summary><sub>dns + runner substrate · 1&nbsp;chain</sub></summary>

<pre>
<em>Runner.Worker</em>
└─ <strong>bash</strong>
   └─ <strong>node</strong>
      └─ → localhost (dns resolver)
</pre>

</details>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-59af-7208-a4f7-6cfecaae0c59&amp;utm_source=github&amp;utm_medium=pr_comment">View this job's Execution Profile in Garnet →</a></sub></p>

</details>

<details><summary><code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437"><code>install-only</code>&nbsp;↗</a> · Run workload reached 1 destination</summary>

<pre>
<em>Runner.Worker</em>
└─ <strong>bash</strong>
   └─ <strong>node</strong>
      └─ → registry.npmjs[.]org
</pre>

<details><summary><sub>dns + runner substrate · 3&nbsp;chains</sub></summary>

<pre>
<em>systemd</em>
└─ <em>hosted-compute-agent</em>
   ├─ <em>sudo</em>
   │  └─ <em>provjobd</em>
   │     └─ → hosted-compute-watchdog-prod-iad-01[.]githubapp
   └─ → 140.82.112.23
<em>Runner.Worker</em>
└─ <strong>bash</strong>
   └─ <strong>node</strong>
      └─ → localhost (dns resolver)
</pre>

</details>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-571c-78d6-8a61-dd43f61c441c&amp;utm_source=github&amp;utm_medium=pr_comment">View this job's Execution Profile in Garnet →</a></sub></p>

</details>

<details><summary><code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437"><code>lint</code>&nbsp;↗</a></summary>

<details><summary><sub>dns + runner substrate · 3&nbsp;chains</sub></summary>

<pre>
<em>systemd</em>
└─ <em>hosted-compute-agent</em>
   ├─ <em>sudo</em>
   │  └─ <em>provjobd</em>
   │     ├─ → hosted-compute-watchdog-prod-iad-02[.]githubapp
   │     └─ → localhost (dns resolver)
   └─ → 140.82.113.24
</pre>

</details>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-54b9-704c-a002-a7d9d70b271b&amp;utm_source=github&amp;utm_medium=pr_comment">View this job's Execution Profile in Garnet →</a></sub></p>

</details>

<details><summary><code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437"><code>typecheck</code>&nbsp;↗</a></summary>

<details><summary><sub>dns + runner substrate · 3&nbsp;chains</sub></summary>

<pre>
<em>systemd</em>
└─ <em>hosted-compute-agent</em>
   ├─ <em>sudo</em>
   │  └─ <em>provjobd</em>
   │     ├─ → hosted-compute-watchdog-prod-iad-02[.]githubapp
   │     └─ → localhost (dns resolver)
   └─ → 140.82.114.24
</pre>

</details>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-5ca7-7f9d-bfb3-c59ccde51111&amp;utm_source=github&amp;utm_medium=pr_comment">View this job's Execution Profile in Garnet →</a></sub></p>

</details>

<details><summary><code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437"><code>workload-egress</code>&nbsp;↗</a> · Run workload reached 4 destinations</summary>

<pre>
<em>Runner.Worker</em>
└─ <strong>bash</strong>
   └─ <strong>node</strong>
      ├─ <strong>dash</strong>
      │  └─ <strong>node</strong>
      │     ├─ <strong>dash</strong>
      │     │  └─ <strong>curl</strong>
      │     │     └─ → httpbin[.]org
      │     ├─ → api.garnet[.]ai
      │     └─ → github[.]com
      └─ → registry.npmjs[.]org
</pre>

<details><summary><sub>dns + runner substrate · 3&nbsp;chains</sub></summary>

<pre>
<em>systemd</em>
└─ <em>hosted-compute-agent</em>
   ├─ <em>sudo</em>
   │  └─ <em>provjobd</em>
   │     └─ → hosted-compute-watchdog-prod-iad-02[.]githubapp
   └─ → 140.82.113.23
<em>Runner.Worker</em>
└─ <strong>bash</strong>
   └─ <strong>node</strong>
      └─ → localhost (dns resolver)
</pre>

</details>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-5992-7409-89cf-6d88e0fb46ea&amp;utm_source=github&amp;utm_medium=pr_comment">View this job's Execution Profile in Garnet →</a></sub></p>

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
