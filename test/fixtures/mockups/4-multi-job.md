<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit 692fee142af0938c6d7e6e77eb14b654e5147c6e -->
### Garnet Runtime Review
**See what ran** — every process your jobs executed, and where they connected

> <sub>*commit [`692fee1`](https://github.com/garnet-org/runtime-review-testbed/commit/692fee142af0938c6d7e6e77eb14b654e5147c6e) · recorded at the kernel · as of Jul 8 2026, 5:36 AM UTC*</sub>
> <details><summary><sub>💡 how to read this</sub></summary>
>
> <sub><b>Each fold below is one CI job.</b> Its heading is <b>workflow / job ↗</b> — the job name links to its GitHub Actions run — followed by what Garnet's kernel-level sensor counted.</sub>
>
> <sub>Open a fold and read the tree top-down — exactly as it renders below:</sub>
> <pre>
> <i>Runner.Worker</i>                     ← italic = runner scaffolding
>    └─ <b>bash</b>
>       └─ <b>curl</b>                     ← bold = a process the job ran
>          ├─ → httpbin.org         ← a place it reached
>          └─ → localhost <i>(dns resolver)</i>  ← a note = expected plumbing
> </pre>
> <sub><i>Italics</i> are the runner's own scaffolding, not your code · a bare IP means no domain was observed for it · ×N = the same connection, N times · localhost lookups render in the tree but aren't counted as destinations · a job that reached a destination no other job reached starts open — a glance, not a verdict. For the full record, open <b>View Run Profile in Garnet ↗</b>.</sub>
>
> </details>

<sub><i>5 jobs recorded on this commit</i></sub>

<details open><summary><b><code>Garnet Runtime Review</code></b> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/28920090126"><b><code>workload-egress</code></b> ↗</a> — <i>12 processes · reached 6 destinations</i></summary>

<br>

<pre>
<i>workload-egress · job</i>
└─ <i>systemd</i>
   └─ <i>hosted-compute-agent</i>
      ├─ <i>Runner.Listener</i>
      │  └─ <i>Runner.Worker</i>
      │     └─ <b>bash</b>
      │        └─ <b>node</b>
      │           ├─ <b>dash</b>
      │           │  └─ <b>node</b>
      │           │     ├─ <b>dash</b>
      │           │     │  └─ <b>curl</b>
      │           │     │     ├─ → localhost <i>(dns resolver)</i>
      │           │     │     └─ → httpbin.org
      │           │     ├─ → registry.npmjs.org
      │           │     ├─ → api.garnet.ai <i>(garnet sensor upload)</i>
      │           │     ├─ → localhost <i>(dns resolver)</i>
      │           │     └─ → github.com
      │           ├─ → registry.npmjs.org
      │           └─ → localhost <i>(dns resolver)</i>
      ├─ <i>sudo</i>
      │  └─ <i>provjobd56071233</i>
      │     ├─ → localhost <i>(dns resolver)</i>
      │     └─ → glb-2a3c35-public-internal.githubapp.com <i>(github infra)</i>
      └─ → 140.82.113.24 <i>(github infra)</i>
</pre>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/28920090126?utm_source=github&amp;utm_medium=pr_comment">View Run Profile in Garnet ↗</a></sub></p>

</details>

<details><summary><b><code>Garnet Runtime Review</code></b> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/28920090126"><b><code>docs-build</code></b> ↗</a> — <i>8 processes · reached 1 domain</i></summary>

<br>

<pre>
<i>docs-build · job</i>
└─ <i>systemd</i>
   └─ <i>hosted-compute-agent</i>
      ├─ <i>Runner.Listener</i>
      │  └─ <i>Runner.Worker</i>
      │     └─ <b>bash</b>
      │        └─ <b>node</b>
      │           ├─ → registry.npmjs.org
      │           └─ → localhost <i>(dns resolver)</i>
      └─ <i>sudo</i>
         └─ <i>provjobd2497374024</i>
            └─ → localhost <i>(dns resolver)</i>
</pre>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/28920090126?utm_source=github&amp;utm_medium=pr_comment">View Run Profile in Garnet ↗</a></sub></p>

</details>

<details><summary><b><code>Garnet Runtime Review</code></b> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/28920090126"><b><code>install-only</code></b> ↗</a> — <i>8 processes · reached 1 domain</i></summary>

<br>

<pre>
<i>install-only · job</i>
└─ <i>systemd</i>
   └─ <i>hosted-compute-agent</i>
      ├─ <i>Runner.Listener</i>
      │  └─ <i>Runner.Worker</i>
      │     └─ <b>bash</b>
      │        └─ <b>node</b>
      │           ├─ → registry.npmjs.org
      │           └─ → localhost <i>(dns resolver)</i>
      └─ <i>sudo</i>
         └─ <i>provjobd3567718494</i>
            └─ → localhost <i>(dns resolver)</i>
</pre>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/28920090126?utm_source=github&amp;utm_medium=pr_comment">View Run Profile in Garnet ↗</a></sub></p>

</details>

<details><summary><b><code>Garnet Runtime Review</code></b> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/28920090126"><b><code>lint</code></b> ↗</a> — <i>4 processes · reached 2 destinations</i></summary>

<br>

<pre>
<i>lint · job</i>
└─ <i>systemd</i>
   └─ <i>hosted-compute-agent</i>
      ├─ <i>sudo</i>
      │  └─ <i>provjobd577768862</i>
      │     ├─ → localhost <i>(dns resolver)</i>
      │     └─ → glb-2a3c35-public-internal.githubapp.com <i>(github infra)</i>
      └─ → 140.82.113.23 <i>(github infra)</i>
</pre>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/28920090126?utm_source=github&amp;utm_medium=pr_comment">View Run Profile in Garnet ↗</a></sub></p>

</details>

<details><summary><b><code>Garnet Runtime Review</code></b> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/28920090126"><b><code>typecheck</code></b> ↗</a> — <i>4 processes · reached 1 domain</i></summary>

<br>

<pre>
<i>typecheck · job</i>
└─ <i>systemd</i>
   └─ <i>hosted-compute-agent</i>
      ├─ <i>sudo</i>
      │  └─ <i>provjobd3401506371</i>
      │     ├─ → localhost <i>(dns resolver)</i>
      │     └─ → glb-2a3c35-public-internal.githubapp.com <i>(github infra)</i>
      └─ → glb-2a3c35-public-internal.githubapp.com <i>(github infra)</i>
</pre>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/28920090126?utm_source=github&amp;utm_medium=pr_comment">View Run Profile in Garnet ↗</a></sub></p>

</details>

