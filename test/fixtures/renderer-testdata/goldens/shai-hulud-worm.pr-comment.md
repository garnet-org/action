<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit 7777777777777777777777777777777777777777 -->
<!-- garnet:summary {"contract":"6.10.0","githubMeta":"2026-08-08","commit":"7777777777777777777777777777777777777777","previous":"8888888888888888888888888888888888888888","jobs":1,"changed":1,"unchanged":0,"noOutbound":0,"vanished":0,"added":3,"removed":0,"backgroundAdded":0,"backgroundRemoved":0,"vanishedDestinations":0,"chains":5,"destinations":5,"recorded":"2026-08-07 18:30:00 UTC","kinds":["network"]} -->
**Execution Profiles recorded for 1 job, triggered by [`7777777`](https://github.com/garnet-org/runtime-review-testbed/commit/7777777777777777777777777777777777777777)**

> *1&nbsp;job changed +3&nbsp;destinations · compared with [`8888888`](https://github.com/garnet-org/runtime-review-testbed/commit/8888888888888888888888888888888888888888)*
> <sub>recorded at the kernel by Garnet · 2026-08-07 18:30 UTC</sub>

<details open><summary><b>+3</b> · <code>ci</code> / <a href="https://github.com/garnet-labs/posthog/actions/runs/32100000007"><code>install</code>&nbsp;↗</a></summary>

```diff
@@ 8888888 (previous) vs 7777777 (current) @@
  Runner.Worker
  └─ npm
     └─ node (step: "Install")
+       ├─ sh
+       │  └─ bun
+       │     ├─ ○ 169.254.169.254 (cloud metadata)
+       │     ├─ ○ api.github[.]com
+       │     └─ ○ release-assets.githubusercontent[.]com
        └─ ○ registry.npmjs[.]org
 
  systemd
  └─ hosted-compute-agent
     └─ sudo
        └─ provjobd
           └─ ○ resultsstorageeus2.blob.core.windows[.]net
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

<sub><i>+ only in the current record · − only in the previous record</i></sub>

</details>
