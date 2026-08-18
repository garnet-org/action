<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit bb22cc33dd44ee55ff6677889900aabbccddee11 -->
<!-- garnet:summary {"contract":"6.10.0","githubMeta":"2026-08-08","commit":"bb22cc33dd44ee55ff6677889900aabbccddee11","previous":"aa11bb22cc33dd44ee55ff6677889900aabbccdd","jobs":1,"changed":1,"unchanged":0,"noOutbound":0,"vanished":0,"added":2,"removed":1,"backgroundAdded":0,"backgroundRemoved":0,"vanishedDestinations":0,"chains":3,"destinations":3,"recorded":"2026-08-07 16:00:00 UTC","kinds":["network"]} -->
**Execution Profiles recorded for 1 job, triggered by [`bb22cc3`](https://github.com/garnet-org/runtime-review-testbed/commit/bb22cc33dd44ee55ff6677889900aabbccddee11)**

> *1&nbsp;job changed +2&nbsp;−1&nbsp;destinations · compared with [`aa11bb2`](https://github.com/garnet-org/runtime-review-testbed/commit/aa11bb22cc33dd44ee55ff6677889900aabbccdd)*
> <sub>recorded at the kernel by Garnet · 2026-08-07 16:00 UTC</sub>

<details open><summary><b>+2&nbsp;−1</b> · <code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000020"><code>branches</code>&nbsp;↗</a></summary>

```diff
@@ aa11bb2 (previous) vs bb22cc3 (current) @@
  Runner.Worker
  └─ bash
     ├─ node (step: "Run tests")
+    │  ├─ ○ fresh.example[.]net
     │  └─ ○ kept.example[.]com
-    ├─ go (step: "Build binary")
-    │  └─ ○ proxy.golang[.]example
+    └─ python3
+       └─ pip (step: "Install tools")
+          └─ ○ pypi.example[.]org
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
