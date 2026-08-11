<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit 6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e -->
<!-- garnet:summary {"contract":"6.9.5","commit":"6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e","previous":null,"jobs":1,"changed":null,"unchanged":null,"noOutbound":null,"vanished":null,"added":null,"removed":null,"vanishedDestinations":null,"chains":10,"destinations":6,"kinds":["network"]} -->
**Execution Profiles recorded for 1 job, triggered by [`6e5d0d4`](https://github.com/garnet-org/runtime-review-testbed/commit/6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e)**

> *6&nbsp;destinations · recorded at the kernel by Garnet · 2026-07-13 23:54:23 UTC*

<details><summary><code>Garnet Runtime Review (dev)</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366365"><code>runtime-review-dev</code>&nbsp;↗</a> · 6&nbsp;destinations</summary>

<pre>
Runner.Worker
└─ bash
   └─ <strong>node</strong> <em>(step: &quot;Check for dev project token&quot;)</em>
      ├─ dash
      │  └─ <strong>node</strong> <em>(step: &quot;Install dependencies&quot;)</em>
      │     ├─ dash
      │     │  └─ <strong>curl</strong>
      │     │     └─ ○ httpbin[.]org
      │     ├─ ○ api.garnet[.]ai <em>(garnet sensor)</em>
      │     └─ ○ github[.]com
      ├─ ○ localhost <em>(dns resolver)</em>
      └─ ○ registry.npmjs[.]org

systemd
└─ hosted-compute-agent
   └─ sudo
      └─ <strong>provjobd</strong> <em>(ran from /tmp/…)</em>
         └─ ○ hosted-compute-watchdog-prod-iad-01[.]githubapp <em>(github infra)</em>
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

</details>
