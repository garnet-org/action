<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit 6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e -->
<!-- garnet:summary {"contract":"6.10.0","commit":"6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e","previous":null,"jobs":5,"changed":null,"unchanged":null,"noOutbound":null,"vanished":null,"added":null,"removed":null,"backgroundAdded":null,"backgroundRemoved":null,"vanishedDestinations":null,"chains":25,"destinations":19,"kinds":["network"]} -->
**Execution Profiles recorded for 5 jobs, triggered by [`6e5d0d4`](https://github.com/garnet-org/runtime-review-testbed/commit/6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e)**

> *19&nbsp;destinations across 5&nbsp;jobs*
> <sub>recorded at the kernel by Garnet · 2026-07-13 23:54 UTC</sub>

<details><summary><code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437"><code>docs-build</code>&nbsp;↗</a> · 2&nbsp;destinations</summary>

<pre>
Runner.Worker
└─ bash
   └─ <strong>node</strong> <em>(step: &quot;Run workload&quot;)</em>
      ├─ ○ localhost <em>(dns resolver)</em>
      └─ ○ registry.npmjs[.]org
</pre>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-59af-7208-a4f7-6cfecaae0c59&amp;utm_source=github&amp;utm_medium=pr_comment">View this job's Execution Profile in Garnet →</a></sub></p>

</details>

<details><summary><code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437"><code>install-only</code>&nbsp;↗</a> · 4&nbsp;destinations</summary>

<pre>
Runner.Worker
└─ bash
   └─ <strong>node</strong> <em>(step: &quot;Run workload&quot;)</em>
      ├─ ○ localhost <em>(dns resolver)</em>
      └─ ○ registry.npmjs[.]org

systemd
└─ <strong>hosted-compute-agent</strong>
   ├─ sudo
   │  └─ <strong>provjobd</strong> <em>(ran from /tmp/…)</em>
   │     └─ ○ hosted-compute-watchdog-prod-iad-01[.]githubapp <em>(github infra)</em>
   └─ ○ 140.82.112.23
</pre>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-571c-78d6-8a61-dd43f61c441c&amp;utm_source=github&amp;utm_medium=pr_comment">View this job's Execution Profile in Garnet →</a></sub></p>

</details>

<details><summary><code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437"><code>lint</code>&nbsp;↗</a> · 3&nbsp;destinations</summary>

<pre>
systemd
└─ <strong>hosted-compute-agent</strong>
   ├─ sudo
   │  └─ <strong>provjobd</strong> <em>(ran from /tmp/…)</em>
   │     ├─ ○ hosted-compute-watchdog-prod-iad-02[.]githubapp <em>(github infra)</em>
   │     └─ ○ localhost <em>(dns resolver)</em>
   └─ ○ 140.82.113.24
</pre>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-54b9-704c-a002-a7d9d70b271b&amp;utm_source=github&amp;utm_medium=pr_comment">View this job's Execution Profile in Garnet →</a></sub></p>

</details>

<details><summary><code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437"><code>typecheck</code>&nbsp;↗</a> · 3&nbsp;destinations</summary>

<pre>
systemd
└─ <strong>hosted-compute-agent</strong>
   ├─ sudo
   │  └─ <strong>provjobd</strong> <em>(ran from /tmp/…)</em>
   │     ├─ ○ hosted-compute-watchdog-prod-iad-02[.]githubapp <em>(github infra)</em>
   │     └─ ○ localhost <em>(dns resolver)</em>
   └─ ○ 140.82.114.24
</pre>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-5ca7-7f9d-bfb3-c59ccde51111&amp;utm_source=github&amp;utm_medium=pr_comment">View this job's Execution Profile in Garnet →</a></sub></p>

</details>

<details><summary><code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437"><code>workload-egress</code>&nbsp;↗</a> · 7&nbsp;destinations</summary>

<pre>
Runner.Worker
└─ bash
   └─ <strong>node</strong> <em>(step: &quot;Run workload&quot;)</em>
      ├─ dash
      │  └─ <strong>node</strong>
      │     ├─ dash
      │     │  └─ <strong>curl</strong>
      │     │     └─ ○ httpbin[.]org
      │     ├─ ○ api.garnet[.]ai <em>(garnet sensor)</em>
      │     └─ ○ github[.]com
      ├─ ○ localhost <em>(dns resolver)</em>
      └─ ○ registry.npmjs[.]org

systemd
└─ <strong>hosted-compute-agent</strong>
   ├─ sudo
   │  └─ <strong>provjobd</strong> <em>(ran from /tmp/…)</em>
   │     └─ ○ hosted-compute-watchdog-prod-iad-02[.]githubapp <em>(github infra)</em>
   └─ ○ 140.82.113.23
</pre>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-5992-7409-89cf-6d88e0fb46ea&amp;utm_source=github&amp;utm_medium=pr_comment">View this job's Execution Profile in Garnet →</a></sub></p>

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
