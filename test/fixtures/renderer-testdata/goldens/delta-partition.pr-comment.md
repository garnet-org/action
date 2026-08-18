<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit 7777777777777777777777777777777777777777 -->
<!-- garnet:summary {"contract":"6.10.0","commit":"7777777777777777777777777777777777777777","previous":"8888888888888888888888888888888888888888","jobs":1,"changed":1,"unchanged":0,"noOutbound":0,"vanished":0,"added":1,"removed":0,"backgroundAdded":2,"backgroundRemoved":2,"vanishedDestinations":0,"chains":4,"destinations":4,"kinds":["network"]} -->
**Execution Profiles recorded for 1 job, triggered by [`7777777`](https://github.com/garnet-org/runtime-review-testbed/commit/7777777777777777777777777777777777777777)**

> *1&nbsp;job changed +1&nbsp;destination · compared with [`8888888`](https://github.com/garnet-org/runtime-review-testbed/commit/8888888888888888888888888888888888888888)*
> <sub>recorded at the kernel by Garnet · 2026-08-07 18:30 UTC</sub>

<details open><summary><b>+1</b> · <code>ci</code> / <a href="https://github.com/garnet-labs/posthog/actions/runs/32100000002"><code>build</code>&nbsp;↗</a></summary>

```diff
@@ 8888888 (previous) vs 7777777 (current) @@
  Runner.Worker
  └─ npm
     └─ node (step: "Install")
+       ├─ ○ evil-mirror.example[.]com
        └─ ○ registry.npmjs[.]org
 
  systemd (runner background · +2 −2)
  └─ hosted-compute-
     └─ sudo
        └─ provjobd
-          ├─ ○ 140.82.113.23
+          ├─ ○ glb-p4a577-public-internal.githubapp[.]com (github infra)
+          ├─ ○ resultsstorageeus2.blob.core.windows[.]net
-          └─ ○ resultsstoragewus3.blob.core.windows[.]net
```

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

<sub><i>+ only in the current record · − only in the previous record · runner background = the runner's infrastructure, not your workflow</i></sub>

</details>
