<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit 786a5bc8680486720bcf5dae13931de95d89b5ec -->
### Garnet Runtime Review
**See what ran** — every process your jobs executed, and where they connected

> <sub>*commit [`786a5bc`](https://github.com/garnet-org/runtime-review-testbed/commit/786a5bc8680486720bcf5dae13931de95d89b5ec) · recorded at the kernel · as of Jul 3 2026, 2:02 PM UTC*</sub>
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

<sub><i>1 job recorded on this commit</i></sub>

<details open><summary><b><code>Garnet Runtime Review</code></b> / <a href="https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28488074733"><b><code>runtime-review</code></b> ↗</a> — <i>6 processes · reached 1 domain</i></summary>

<br>

<pre>
<i>runtime-review · job</i>
└─ <i>systemd</i>
   └─ <i>hosted-compute-agent</i>
      └─ <i>Runner.Listener</i>
         └─ <i>Runner.Worker</i>
            └─ <b>bash</b>
               └─ <b>npm install</b>
                  └─ → registry.npmjs.org
</pre>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/28488074733?utm_source=github&amp;utm_medium=pr_comment">View Run Profile in Garnet ↗</a></sub></p>

</details>

