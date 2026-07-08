<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
### Garnet Runtime Review
> *commit [`786a5bc`](https://github.com/garnet-org/runtime-review-testbed/commit/786a5bc8680486720bcf5dae13931de95d89b5ec)* · *jobs recorded as of Jul 3 2026, 2:02 PM UTC*
>
> <details><summary><sub><i>What happened on this commit — each job's process tree and where it reached</i> · 💡 how to read this</sub></summary>
>
> <sub>Each row is one recorded CI job — <b>workflow / job ↗</b>, the job name linking to its GitHub Actions run — with the counts Garnet's sensor recorded at the kernel level. Open a job for its process tree: <b>bold</b> = a process the job ran, <i>italic</i> = runner scaffolding, <code>→</code> = destination reached. Notes like <i>(github infra)</i> mark platform plumbing; a bare IP means no domain was observed for that connection. Jobs that reached a destination unique to them in this commit start expanded; <i>View Run Profile in Garnet ↗</i> opens the full record.</sub>
>
> </details>

<details open><summary><b><code>Garnet Runtime Review</code></b> / <a href="https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28488074733"><b><code>runtime-review</code></b> ↗</a> — <i>6 processes · contacted 1 domain</i></summary>

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

