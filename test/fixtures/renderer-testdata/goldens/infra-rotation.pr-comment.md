<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit aa11bb22cc33dd44ee55ff667788990011223344 -->
<!-- garnet:summary {"contract":"6.10.0","githubMeta":"2026-08-08","commit":"aa11bb22cc33dd44ee55ff667788990011223344","previous":"99887766554433221100ffeeddccbbaa99887766","jobs":1,"changed":1,"unchanged":0,"noOutbound":0,"vanished":0,"added":1,"removed":0,"backgroundAdded":0,"backgroundRemoved":0,"vanishedDestinations":0,"chains":4,"destinations":4,"recorded":"2026-08-07 18:30:00 UTC","kinds":["network"]} -->
**Execution Profiles recorded for 1 job, triggered by [`aa11bb2`](https://github.com/garnet-org/runtime-review-testbed/commit/aa11bb22cc33dd44ee55ff667788990011223344)**

> *1&nbsp;job changed +1&nbsp;destination · compared with [`9988776`](https://github.com/garnet-org/runtime-review-testbed/commit/99887766554433221100ffeeddccbbaa99887766)*
> <sub>recorded at the kernel by Garnet · 2026-08-07 18:30 UTC</sub>

<details open><summary><b>+1</b> · <code>ci</code> / <a href="https://github.com/garnet-labs/posthog/actions/runs/32100000002"><code>build</code>&nbsp;↗</a></summary>

```diff
@@ 9988776 (previous) vs aa11bb2 (current) @@
  Runner.Worker
  └─ bash
     └─ node (step: "Build")
        ├─ ○ registry.npmjs[.]org
+       └─ ○ storage.googleapis[.]com
 
  systemd
  └─ hosted-compute-
     └─ sudo
        └─ provjobd
           ├─ ○ 140.82.114.23
           └─ ○ 140.82.114.24
```

<sub><i>2 addresses rotated (github infra)</i></sub>

</details>

---

<details><summary><sub>💡 How to read this</sub></summary>

<pre>
Runner.Worker          <em>← process on a path</em>
└─ npm
   └─ <strong>node</strong>             <em>← process that acted</em>
      └─ ○ npmjs[.]org <em>← observed action</em>
</pre>

<sub><i>follow a path downward to see what ran and what it did — each path to an observed action is an execution chain</i></sub>

<sub><i>names on the path = processes · ○ = observed action · (…) = context</i></sub>

<sub><i>+ only in the current record · − only in the previous record</i></sub>

</details>
