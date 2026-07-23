<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit ef01a52517e7532ab34aadea58b952c9f1e79ece -->
### Garnet Runtime Review
**See what ran** — every process your jobs executed, and where they connected

> <sub>*commit [`ef01a52`](https://github.com/garnet-org/runtime-review-testbed/commit/ef01a52517e7532ab34aadea58b952c9f1e79ece) · no jobs recorded yet as of Jul 3 2026, 2:02 PM UTC*</sub>
> <details open><summary><sub>💡 how to read this</sub></summary>
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

⏳ Run Profiles for this commit are still being recorded — this comment updates in place as jobs finish.

<sub>Run already finished? Look in the job log for the Garnet step — the sensor must start before the workload runs.</sub>

---
> <sub>1 job not yet recorded — [add the step ↗](https://github.com/garnet-org/action#readme)</sub>
