<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit cc33dd44ee55ff6677889900aabbccddee112233 -->
<!-- garnet:summary {"contract":"6.10.0","commit":"cc33dd44ee55ff6677889900aabbccddee112233","previous":null,"jobs":1,"changed":null,"unchanged":null,"noOutbound":null,"vanished":null,"added":null,"removed":null,"backgroundAdded":null,"backgroundRemoved":null,"vanishedDestinations":null,"chains":2,"destinations":2,"kinds":["network"]} -->
**Execution Profiles recorded for 1 job, triggered by [`cc33dd4`](https://github.com/garnet-org/runtime-review-testbed/commit/cc33dd44ee55ff6677889900aabbccddee112233)**

> *2&nbsp;destinations*
> <sub>recorded at the kernel by Garnet · 2026-08-07 13:00 UTC</sub>

<details><summary><code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000002"><code>provision</code>&nbsp;↗</a> · 2&nbsp;destinations</summary>

<pre>
systemd
└─ <strong>hosted-compute-agent</strong>
   ├─ sudo
   │  └─ <strong>provjobd</strong>
   │     └─ ○ localhost <em>(dns resolver)</em>
   └─ ○ hosted-compute-watchdog-prod-iad-01[.]githubapp <em>(github infra)</em>
</pre>

<p align="right"><sub><a href="https://app.garnet.ai/public/runs/32000000002?profile=019f2c11-aaaa-7bbb-8ccc-0123456789ab&amp;utm_source=github&amp;utm_medium=pr_comment">View this job's Execution Profile in Garnet →</a></sub></p>

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
