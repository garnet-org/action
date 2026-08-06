<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit 6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e -->
<!-- garnet:summary {"contract":"6.6.1","commit":"6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e","previous":null,"jobs":1,"changed":null,"unchanged":null,"noOutbound":null,"vanished":null,"added":null,"removed":null,"vanishedChains":null,"chains":6,"destinations":6} -->
**Execution Profiles recorded for 1 job, triggered by [`6e5d0d4`](https://github.com/garnet-org/runtime-review-testbed/commit/6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e)**

> *6&nbsp;execution chains · 6&nbsp;destinations · recorded at the kernel by Garnet · 2026-07-13 23:54:23 UTC*

<details><summary><code>Garnet Runtime Review (dev)</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366365"><code>runtime-review-dev</code>&nbsp;↗</a> · Install dependencies reached 3 destinations, Check for dev project token reached 1 destination</summary>

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

<details><summary><sub>dns + runner substrate · 2&nbsp;chains</sub></summary>

<pre>
<em>systemd</em>
└─ <em>hosted-compute-agent</em>
   └─ <em>sudo</em>
      └─ <em>provjobd</em>
         └─ → hosted-compute-watchdog-prod-iad-01[.]githubapp
<em>Runner.Worker</em>
└─ <strong>bash</strong>
   └─ <strong>node</strong>
      └─ → localhost (dns resolver)
</pre>

</details>

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
