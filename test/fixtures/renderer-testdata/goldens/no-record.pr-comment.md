<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit ef01a52517e7532ab34aadea58b952c9f1e79ece -->
### Recording runtime behavior

> <sub>*head* [`ef01a52`](https://github.com/garnet-org/runtime-review-testbed/commit/ef01a52517e7532ab34aadea58b952c9f1e79ece)</sub>

This comment updates when the remaining jobs finish.

---

<details open><summary><sub>How to read this</sub></summary>

<pre>
Runner.Worker          <em>← process on a path</em>
└─ npm
   └─ <strong>node</strong>             <em>← process that acted</em>
      └─ ○ npmjs[.]org <em>← observed action</em>
</pre>

<sub><i>follow a path downward to see what ran and what it did — each path to an observed action is an execution chain · Capture is best-effort.</i></sub>

<sub><i>names on the path = processes · ○ = observed action · (…) = context</i></sub>

</details>

<sub>Runtime behavior, recorded by Garnet. <a href="https://app.garnet.ai/onboarding?utm_source=github&amp;utm_medium=pr_comment&amp;utm_content=add_to_ci">Add it to your CI ↗</a></sub>
