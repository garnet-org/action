<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
### Garnet Runtime Review
> *commit [`692fee1`](https://github.com/garnet-org/runtime-review-testbed/commit/692fee142af0938c6d7e6e77eb14b654e5147c6e)* · *jobs recorded as of Jul 8 2026, 5:36 AM UTC*
>
> <details><summary><sub><i>What happened on this commit — each job's process tree and where it reached</i> · 💡 how to read this</sub></summary>
>
> <sub>Each row is one recorded CI job — <b>workflow / job ↗</b>, the job name linking to its GitHub Actions run — with the counts Garnet's sensor recorded at the kernel level. Open a job for its process tree: <b>bold</b> = a process the job ran, <i>italic</i> = runner scaffolding, <code>→</code> = destination reached. Notes like <i>(github infra)</i> mark platform plumbing; a bare IP means no domain was observed for that connection. Jobs that reached a destination unique to them in this commit start expanded; <i>View Run Profile in Garnet ↗</i> opens the full record.</sub>
>
> </details>

<details open><summary><b><code>Garnet Runtime Review</code></b> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/28920090126"><b><code>workload-egress</code></b> ↗</a> — <i>12 processes · contacted 6 destinations</i></summary>

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

<details><summary><b><code>Garnet Runtime Review</code></b> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/28920090126"><b><code>docs-build</code></b> ↗</a> — <i>8 processes · contacted 1 domain</i></summary>

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

<details><summary><b><code>Garnet Runtime Review</code></b> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/28920090126"><b><code>install-only</code></b> ↗</a> — <i>8 processes · contacted 1 domain</i></summary>

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

<details><summary><b><code>Garnet Runtime Review</code></b> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/28920090126"><b><code>lint</code></b> ↗</a> — <i>4 processes · contacted 2 destinations</i></summary>

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

<details><summary><b><code>Garnet Runtime Review</code></b> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/28920090126"><b><code>typecheck</code></b> ↗</a> — <i>4 processes · contacted 1 domain</i></summary>

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

