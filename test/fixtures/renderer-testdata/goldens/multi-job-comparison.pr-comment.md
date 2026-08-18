<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit bb22cc33dd44ee55ff6677889900aabbccddee11 -->
<!-- garnet:summary {"contract":"6.10.0","commit":"bb22cc33dd44ee55ff6677889900aabbccddee11","previous":"aa11bb22cc33dd44ee55ff6677889900aabbccdd","jobs":3,"changed":1,"unchanged":2,"noOutbound":0,"vanished":0,"added":2,"removed":1,"backgroundAdded":1,"backgroundRemoved":1,"vanishedDestinations":0,"chains":11,"destinations":11,"kinds":["network"]} -->
**Execution Profiles recorded for 3 jobs, triggered by [`bb22cc3`](https://github.com/garnet-org/runtime-review-testbed/commit/bb22cc33dd44ee55ff6677889900aabbccddee11)**

> *1&nbsp;job changed +2&nbsp;−1&nbsp;destinations · 2&nbsp;jobs unchanged · compared with [`aa11bb2`](https://github.com/garnet-org/runtime-review-testbed/commit/aa11bb22cc33dd44ee55ff6677889900aabbccdd)*
> <sub>recorded at the kernel by Garnet · 2026-08-07 12:00 UTC</sub>

<details open><summary><b>+2&nbsp;−1</b> · <code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000001"><code>api</code>&nbsp;↗</a></summary>

```diff
@@ aa11bb2 (previous) vs bb22cc3 (current) @@
  Runner.Worker
  └─ bash
     └─ node (step: "Run api tests")
        ├─ ○ cache.internal[.]example
-       ├─ ○ flap-a.example[.]com (198.51.100.60)
+       ├─ ○ flap-b.example[.]com (198.51.100.61)
+       ├─ ○ fresh.example[.]net
        └─ ○ kept.example[.]com
 
  systemd
  └─ hosted-compute-agent
     ├─ sudo
     │  └─ provjobd
     │     └─ ○ glb-2a3c35-public-internal.githubapp[.]com (github infra)
     └─ ○ telemetry[.]example
```

</details>

<details><summary><code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000001"><code>steady</code>&nbsp;↗</a> · 3&nbsp;destinations</summary>

```diff
@@ aa11bb2 (previous) vs bb22cc3 (current) @@
  Runner.Worker
  └─ bash
     └─ node (step: "Install dependencies")
        └─ ○ registry.npmjs[.]org
 
  systemd (runner background · +1 −1)
  └─ hosted-compute-agent
     ├─ sudo
     │  └─ provjobd
     │     └─ ○ glb-2a3c35-public-internal.githubapp[.]com (github infra)
-    ├─ ○ hosted-compute-watchdog-prod-iad-02.githubapp[.]com (140.82.112.31) (github infra)
+    └─ ○ hosted-compute-watchdog-prod-iad-03.githubapp[.]com (140.82.115.40) (github infra)
```

</details>

<details><summary><code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000001"><code>warmup</code>&nbsp;↗</a> · 2&nbsp;destinations · unchanged</summary>

<pre>
systemd
└─ <strong>hosted-compute-agent</strong>
   ├─ sudo
   │  └─ <strong>provjobd</strong>
   │     └─ ○ localhost <em>(dns resolver)</em>
   └─ ○ hosted-compute-watchdog-prod-iad-02.githubapp[.]com <em>(github infra)</em>
</pre>

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
