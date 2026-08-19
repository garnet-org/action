<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
<!-- garnet:commit dd44ee55ff6677889900aabbccddee1122334455 -->
<!-- garnet:summary {"contract":"6.10.0","githubMeta":"2026-08-08","commit":"dd44ee55ff6677889900aabbccddee1122334455","previous":null,"jobs":2,"changed":null,"unchanged":null,"noOutbound":null,"vanished":null,"added":null,"removed":null,"backgroundAdded":null,"backgroundRemoved":null,"vanishedDestinations":null,"chains":4,"destinations":4,"recorded":"2026-08-07 14:00:00 UTC","kinds":["network"]} -->
**Execution Profiles recorded for 2 jobs, triggered by [`dd44ee5`](https://github.com/garnet-org/runtime-review-testbed/commit/dd44ee55ff6677889900aabbccddee1122334455)**

> *4&nbsp;destinations across 2&nbsp;jobs*
> <sub>recorded at the kernel by Garnet · 2026-08-07 14:00 UTC</sub>

<details><summary><code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000003"><code>provision</code>&nbsp;↗</a> · 2&nbsp;destinations</summary>

<pre>
systemd
├─ <strong>walinuxagent</strong>
│  └─ ○ 168.63.129.16
└─ <strong>python3</strong>
   └─ ○ 169.254.169.254 <em>(cloud metadata)</em>
</pre>

</details>

<details><summary><code>ci</code> / <a href="https://github.com/garnet-org/runtime-review-testbed/actions/runs/32000000003"><code>release</code>&nbsp;↗</a> · 2&nbsp;destinations</summary>

<pre>
Runner.Worker
└─ bash
   └─ <strong>bun</strong> <em>(step: &quot;Run integration tests&quot;)</em>
      └─ ○ 169.254.169.254 <em>(cloud metadata)</em>

systemd
└─ <strong>node</strong> <em>(step: &quot;Publish artifacts&quot;)</em>
   └─ ○ artifacts.example[.]net
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
