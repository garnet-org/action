<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit ef01a52517e7532ab34aadea58b952c9f1e79ece -->
<!-- garnet:summary {"contract":"6.10.0","githubMeta":"2026-08-08","commit":"ef01a52517e7532ab34aadea58b952c9f1e79ece","previous":null,"jobs":1,"changed":null,"unchanged":null,"noOutbound":null,"vanished":null,"added":null,"removed":null,"backgroundAdded":null,"backgroundRemoved":null,"vanishedDestinations":null,"chains":5,"destinations":4,"recorded":null,"kinds":["network"]} -->
### Runtime behavior recorded

<sub>*head* [`ef01a52`](https://github.com/garnet-org/runtime-review-testbed/commit/ef01a52517e7532ab34aadea58b952c9f1e79ece)</sub>

> *4&nbsp;destinations*
> <sub>recorded at the kernel by Garnet</sub>

<details><summary><code>Garnet Runtime Review</code> / <a href="https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28492112239"><code>runtime-review</code>&nbsp;↗</a> · 4&nbsp;destinations</summary>

<pre>
Runner.Worker
└─ bash
   ├─ npm test
   │  └─ sh
   │     └─ <strong>node</strong>
   │        ├─ ○ api.garnet[.]ai <em>(garnet sensor)</em>
   │        ├─ ○ github[.]com
   │        └─ ○ images.unsplash[.]com
   └─ <strong>npm install</strong>
      └─ ○ registry.npmjs[.]org
</pre>

<sub><a href="https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28492112239">Job log</a> · <a href="https://app.garnet.ai/public/runs/28492112239?profile=019f1bca-e403-7ef6-ae2d-74c191dbff8e&amp;utm_source=github&amp;utm_medium=pr_comment">Full record in Garnet ↗</a></sub>

</details>

---

<details><summary><sub>How to read this</sub></summary>

<pre>
Runner.Worker          <em>← process on a path</em>
└─ npm
   └─ <strong>node</strong>             <em>← process that acted</em>
      └─ ○ npmjs[.]org <em>← observed action</em>
</pre>

<sub><i>follow a path downward to see what ran and what it did — each path to an observed action is an execution chain · Capture is best-effort.</i></sub>

<sub><i>names on the path = processes · ○ = observed action · (…) = context</i></sub>

</details>

<sub>Runtime behavior, recorded by Garnet. <a href="https://app.garnet.ai/onboarding?utm_source=github&amp;utm_medium=pr_comment&amp;utm_campaign=garnet-org-runtime-review-testbed-pr22&amp;utm_content=add_to_ci">Add it to your CI ↗</a></sub>
