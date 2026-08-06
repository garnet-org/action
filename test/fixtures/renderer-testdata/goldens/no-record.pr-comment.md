<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit ef01a52517e7532ab34aadea58b952c9f1e79ece -->
**Execution Profiles recording for jobs triggered by [`ef01a52`](https://github.com/garnet-org/runtime-review-testbed/commit/ef01a52517e7532ab34aadea58b952c9f1e79ece)**

⏳ Execution Profiles for this commit are still being recorded — this comment updates in place as jobs finish.

---

<details open><summary><sub>💡 How to read this</sub></summary>

<pre>
<em>Runner.Worker</em>                ← the runner: root of the job's execution tree (italic)
└─ <strong>npm install</strong>               ← a process your job ran (bold)
   └─ → registry.npmjs[.]org  ← an action: what the process did — an outbound connection, defanged
      ╰ one chain of processes, root to action: an execution chain
</pre>

<sub><i>The tree is every chain the job ran; a process appears only when it acted.</i></sub>

</details>
