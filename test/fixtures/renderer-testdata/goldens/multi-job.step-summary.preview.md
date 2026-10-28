## Garnet Execution Summary

### Workload context

| Field | Value |
| --- | --- |
| Profile | [019f5de7-59af-7208-a4f7-6cfecaae0c59](https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-59af-7208-a4f7-6cfecaae0c59&utm_source=github&utm_medium=step_summary) |
| Workflow | ci |
| Job | docs-build |
| Matrix job index | 2 |
| Repository | garnet-org/runtime-review-testbed |
| Branch | refs/pull/76/merge |
| Pull request | [#76](https://github.com/garnet-org/runtime-review-testbed/pull/76) |
| Commit | 6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e |
| Event | pull&#95;request |
| Triggered by | devin-ai-integration&#91;bot&#93; |
| Run | [29294366437](https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437) · attempt 1 |
| Coverage | recorded at the kernel (Linux X64) by Garnet. Capture is best-effort. |
| Workload activity | 1&nbsp;execution chain · 2&nbsp;destinations · 2&nbsp;destination associations |
| Runner activity | 1&nbsp;execution chain · 1&nbsp;destination · 1&nbsp;destination association |
| Sensor network totals | 2&nbsp;unique domains · 2&nbsp;connections |
| Recorded at | 2026-07-13 23:54:30 UTC |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;2384</sub><br><sub>step: &quot;Run workload&quot;</sub> | · <code>registry.npmjs&#91;.&#93;org</code><br>· <code>localhost</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd920019609</code> <sub>pid&nbsp;1867</sub> | <code>localhost</code> |

<details><summary><sub>Execution chains · 3&nbsp;destination associations</sub></summary>

<pre>
systemd
└─ hosted-compute-agent
   └─ Runner.Listener
      └─ Runner.Worker
         └─ bash
            └─ <strong>node</strong> <em>(pid 2384)</em> <em>(step: &quot;Run workload&quot;)</em>
               ├─ ○ registry.npmjs&#91;.&#93;org [104.16.6&#91;.&#93;34] :443 (https) TCP
               └─ ○ localhost [127.0.0&#91;.&#93;53] :53 (dns) UDP

systemd
└─ hosted-compute-agent
   └─ sudo
      └─ <strong>provjobd920019609</strong> <em>(pid 1867)</em> <em>(ran from /tmp/…)</em>
         └─ ○ localhost [127.0.0&#91;.&#93;53] :53 (dns) UDP
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>registry.npmjs.org [104.16.6.34] :443 (https) TCP</code> | <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node (pid 2384)</code> | step: 4. Run workload (${{ matrix.job&#95;name }}) · attention |
| <code>localhost [127.0.0.53] :53 (dns) UDP</code> | <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node (pid 2384)</code> | step: 4. Run workload (${{ matrix.job&#95;name }}) · attention |
| <code>localhost [127.0.0.53] :53 (dns) UDP</code> | <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd920019609 (pid 1867)</code> | step: 99. Runner Processes · attention |

</details>

<details><summary><strong>Assertions</strong></summary>

| Check | Result | Context |
| --- | --- | --- |
| A process contacted a bad network domain. | `attention` | Network Egress · no&#95;bad&#95;egress&#95;domain |
| A program was executed, and then its file was deleted. | `pass` | Stealth · no&#95;binary&#95;execution&#95;and&#95;deletion |
| A process initiated code injection via /proc/{pid}/mem access. | `pass` | Privilege Escalation · no&#95;code&#95;injection&#95;via&#95;proc&#95;memory |

</details>

<div align="right">
<a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-59af-7208-a4f7-6cfecaae0c59&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>

---

## Garnet Execution Summary

### Workload context

| Field | Value |
| --- | --- |
| Profile | [019f5de7-571c-78d6-8a61-dd43f61c441c](https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-571c-78d6-8a61-dd43f61c441c&utm_source=github&utm_medium=step_summary) |
| Workflow | ci |
| Job | install-only |
| Matrix job index | 1 |
| Repository | garnet-org/runtime-review-testbed |
| Branch | refs/pull/76/merge |
| Pull request | [#76](https://github.com/garnet-org/runtime-review-testbed/pull/76) |
| Commit | 6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e |
| Event | pull&#95;request |
| Triggered by | devin-ai-integration&#91;bot&#93; |
| Run | [29294366437](https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437) · attempt 1 |
| Coverage | recorded at the kernel (Linux X64) by Garnet. Capture is best-effort. |
| Workload activity | 1&nbsp;execution chain · 2&nbsp;destinations · 2&nbsp;destination associations |
| Runner activity | 2&nbsp;execution chains · 3&nbsp;destinations · 3&nbsp;destination associations |
| Sensor network totals | 4&nbsp;unique domains · 4&nbsp;connections |
| Recorded at | 2026-07-13 23:54:30 UTC |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>hosted-compute-agent</code> <sub>pid&nbsp;1878</sub> | <code>140.82.112&#91;.&#93;23</code> |
| <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;2371</sub><br><sub>step: &quot;Run workload&quot;</sub> | · <code>registry.npmjs&#91;.&#93;org</code><br>· <code>localhost</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd1326539233</code> <sub>pid&nbsp;1893</sub> | · <code>localhost</code><br>· <code>hosted-compute-watchdog-prod-iad-01&#91;.&#93;githubapp</code> |

<details><summary><sub>Execution chains · 5&nbsp;destination associations</sub></summary>

<pre>
systemd
└─ hosted-compute-agent
   └─ Runner.Listener
      └─ Runner.Worker
         └─ bash
            └─ <strong>node</strong> <em>(pid 2371)</em> <em>(step: &quot;Run workload&quot;)</em>
               ├─ ○ registry.npmjs&#91;.&#93;org [104.16.6&#91;.&#93;34] :443 (https) TCP
               └─ ○ localhost [127.0.0&#91;.&#93;53] :53 (dns) UDP

systemd
└─ <strong>hosted-compute-agent</strong> <em>(pid 1878)</em>
   └─ ○ 140.82.112&#91;.&#93;23 :443 (https) TCP

systemd
└─ hosted-compute-agent
   └─ sudo
      └─ <strong>provjobd1326539233</strong> <em>(pid 1893)</em> <em>(ran from /tmp/…)</em>
         ├─ ○ localhost [127.0.0&#91;.&#93;53] :53 (dns) UDP
         └─ ○ hosted-compute-watchdog-prod-iad-01&#91;.&#93;githubapp [140.82.114&#91;.&#93;23] :443 (https) TCP · also recorded: glb-2a3c35-public-internal.githubapp&#91;.&#93;com <em>(github infra)</em>
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>140.82.112.23 :443 (https) TCP</code> | <code>systemd</code> → <code>hosted-compute-agent (pid 1878)</code> | step: 99. Runner Processes |
| <code>registry.npmjs.org [104.16.6.34] :443 (https) TCP</code> | <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node (pid 2371)</code> | step: 4. Run workload (${{ matrix.job&#95;name }}) · attention |
| <code>localhost [127.0.0.53] :53 (dns) UDP</code> | <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node (pid 2371)</code> | step: 4. Run workload (${{ matrix.job&#95;name }}) · attention |
| <code>localhost [127.0.0.53] :53 (dns) UDP</code> | <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd1326539233 (pid 1893)</code> | step: 99. Runner Processes · attention |
| <code>hosted-compute-watchdog-prod-iad-01.githubapp [140.82.114.23] :443 (https) TCP · also recorded: glb-2a3c35-public-internal.githubapp.com</code> | <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd1326539233 (pid 1893)</code> | step: 99. Runner Processes · (github infra) |

</details>

<details><summary><strong>Assertions</strong></summary>

| Check | Result | Context |
| --- | --- | --- |
| A process contacted a bad network domain. | `attention` | Network Egress · no&#95;bad&#95;egress&#95;domain |
| A program was executed, and then its file was deleted. | `pass` | Stealth · no&#95;binary&#95;execution&#95;and&#95;deletion |
| A process initiated code injection via /proc/{pid}/mem access. | `pass` | Privilege Escalation · no&#95;code&#95;injection&#95;via&#95;proc&#95;memory |

</details>

<div align="right">
<a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-571c-78d6-8a61-dd43f61c441c&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>

---

## Garnet Execution Summary

### Workload context

| Field | Value |
| --- | --- |
| Profile | [019f5de7-54b9-704c-a002-a7d9d70b271b](https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-54b9-704c-a002-a7d9d70b271b&utm_source=github&utm_medium=step_summary) |
| Workflow | ci |
| Job | lint |
| Matrix job index | 3 |
| Repository | garnet-org/runtime-review-testbed |
| Branch | refs/pull/76/merge |
| Pull request | [#76](https://github.com/garnet-org/runtime-review-testbed/pull/76) |
| Commit | 6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e |
| Event | pull&#95;request |
| Triggered by | devin-ai-integration&#91;bot&#93; |
| Run | [29294366437](https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437) · attempt 1 |
| Coverage | recorded at the kernel (Linux X64) by Garnet. Capture is best-effort. |
| Workload activity | none recorded |
| Runner activity | 2&nbsp;execution chains · 3&nbsp;destinations · 3&nbsp;destination associations |
| Sensor network totals | 3&nbsp;unique domains · 3&nbsp;connections |
| Recorded at | 2026-07-13 23:54:29 UTC |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>hosted-compute-agent</code> <sub>pid&nbsp;1854</sub> | <code>140.82.113&#91;.&#93;24</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd1278877480</code> <sub>pid&nbsp;1868</sub> | · <code>localhost</code><br>· <code>hosted-compute-watchdog-prod-iad-02&#91;.&#93;githubapp</code> |

<details><summary><sub>Execution chains · 3&nbsp;destination associations</sub></summary>

<pre>
systemd
└─ <strong>hosted-compute-agent</strong> <em>(pid 1854)</em>
   └─ ○ 140.82.113&#91;.&#93;24 :443 (https) TCP

systemd
└─ hosted-compute-agent
   └─ sudo
      └─ <strong>provjobd1278877480</strong> <em>(pid 1868)</em> <em>(ran from /tmp/…)</em>
         ├─ ○ localhost [127.0.0&#91;.&#93;53] :53 (dns) UDP
         └─ ○ hosted-compute-watchdog-prod-iad-02&#91;.&#93;githubapp [140.82.112&#91;.&#93;23] :443 (https) TCP · also recorded: glb-2a3c35-public-internal.githubapp&#91;.&#93;com <em>(github infra)</em>
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>140.82.113.24 :443 (https) TCP</code> | <code>systemd</code> → <code>hosted-compute-agent (pid 1854)</code> | step: 99. Runner Processes |
| <code>localhost [127.0.0.53] :53 (dns) UDP</code> | <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd1278877480 (pid 1868)</code> | step: 99. Runner Processes |
| <code>hosted-compute-watchdog-prod-iad-02.githubapp [140.82.112.23] :443 (https) TCP · also recorded: glb-2a3c35-public-internal.githubapp.com</code> | <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd1278877480 (pid 1868)</code> | step: 99. Runner Processes · (github infra) |

</details>

<details><summary><strong>Assertions</strong></summary>

| Check | Result | Context |
| --- | --- | --- |
| A process contacted a bad network domain. | `pass` | Network Egress · no&#95;bad&#95;egress&#95;domain |
| A program was executed, and then its file was deleted. | `pass` | Stealth · no&#95;binary&#95;execution&#95;and&#95;deletion |
| A process initiated code injection via /proc/{pid}/mem access. | `pass` | Privilege Escalation · no&#95;code&#95;injection&#95;via&#95;proc&#95;memory |

</details>

<div align="right">
<a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-54b9-704c-a002-a7d9d70b271b&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>

---

## Garnet Execution Summary

### Workload context

| Field | Value |
| --- | --- |
| Profile | [019f5de7-5ca7-7f9d-bfb3-c59ccde51111](https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-5ca7-7f9d-bfb3-c59ccde51111&utm_source=github&utm_medium=step_summary) |
| Workflow | ci |
| Job | typecheck |
| Matrix job index | 4 |
| Repository | garnet-org/runtime-review-testbed |
| Branch | refs/pull/76/merge |
| Pull request | [#76](https://github.com/garnet-org/runtime-review-testbed/pull/76) |
| Commit | 6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e |
| Event | pull&#95;request |
| Triggered by | devin-ai-integration&#91;bot&#93; |
| Run | [29294366437](https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437) · attempt 1 |
| Coverage | recorded at the kernel (Linux X64) by Garnet. Capture is best-effort. |
| Workload activity | none recorded |
| Runner activity | 2&nbsp;execution chains · 3&nbsp;destinations · 3&nbsp;destination associations |
| Sensor network totals | 3&nbsp;unique domains · 3&nbsp;connections |
| Recorded at | 2026-07-13 23:54:31 UTC |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>hosted-compute-agent</code> <sub>pid&nbsp;1878</sub> | <code>140.82.114&#91;.&#93;24</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd3832655626</code> <sub>pid&nbsp;1893</sub> | · <code>localhost</code><br>· <code>hosted-compute-watchdog-prod-iad-02&#91;.&#93;githubapp</code> |

<details><summary><sub>Execution chains · 3&nbsp;destination associations</sub></summary>

<pre>
systemd
└─ <strong>hosted-compute-agent</strong> <em>(pid 1878)</em>
   └─ ○ 140.82.114&#91;.&#93;24 :443 (https) TCP

systemd
└─ hosted-compute-agent
   └─ sudo
      └─ <strong>provjobd3832655626</strong> <em>(pid 1893)</em> <em>(ran from /tmp/…)</em>
         ├─ ○ localhost [127.0.0&#91;.&#93;53] :53 (dns) UDP
         └─ ○ hosted-compute-watchdog-prod-iad-02&#91;.&#93;githubapp [140.82.113&#91;.&#93;24] :443 (https) TCP · also recorded: glb-2a3c35-public-internal.githubapp&#91;.&#93;com <em>(github infra)</em>
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>140.82.114.24 :443 (https) TCP</code> | <code>systemd</code> → <code>hosted-compute-agent (pid 1878)</code> | step: 99. Runner Processes |
| <code>localhost [127.0.0.53] :53 (dns) UDP</code> | <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd3832655626 (pid 1893)</code> | step: 99. Runner Processes |
| <code>hosted-compute-watchdog-prod-iad-02.githubapp [140.82.113.24] :443 (https) TCP · also recorded: glb-2a3c35-public-internal.githubapp.com</code> | <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd3832655626 (pid 1893)</code> | step: 99. Runner Processes · (github infra) |

</details>

<details><summary><strong>Assertions</strong></summary>

| Check | Result | Context |
| --- | --- | --- |
| A process contacted a bad network domain. | `pass` | Network Egress · no&#95;bad&#95;egress&#95;domain |
| A program was executed, and then its file was deleted. | `pass` | Stealth · no&#95;binary&#95;execution&#95;and&#95;deletion |
| A process initiated code injection via /proc/{pid}/mem access. | `pass` | Privilege Escalation · no&#95;code&#95;injection&#95;via&#95;proc&#95;memory |

</details>

<div align="right">
<a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-5ca7-7f9d-bfb3-c59ccde51111&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>

---

## Garnet Execution Summary

### Workload context

| Field | Value |
| --- | --- |
| Profile | [019f5de7-5992-7409-89cf-6d88e0fb46ea](https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-5992-7409-89cf-6d88e0fb46ea&utm_source=github&utm_medium=step_summary) |
| Workflow | ci |
| Job | workload-egress |
| Matrix job index | 0 |
| Repository | garnet-org/runtime-review-testbed |
| Branch | refs/pull/76/merge |
| Pull request | [#76](https://github.com/garnet-org/runtime-review-testbed/pull/76) |
| Commit | 6e5d0d4cf00a92a9e1fe697efe0e41b3ae61533e |
| Event | pull&#95;request |
| Triggered by | devin-ai-integration&#91;bot&#93; |
| Run | [29294366437](https://github.com/garnet-org/runtime-review-testbed/actions/runs/29294366437) · attempt 1 |
| Coverage | recorded at the kernel (Linux X64) by Garnet. Capture is best-effort. |
| Workload activity | 3&nbsp;execution chains · 6&nbsp;destinations · 8&nbsp;destination associations |
| Runner activity | 2&nbsp;execution chains · 3&nbsp;destinations · 3&nbsp;destination associations |
| Sensor network totals | 7&nbsp;unique domains · 8&nbsp;connections |
| Recorded at | 2026-07-13 23:54:30 UTC |

### Network egress

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Execution chain | Destinations |
| --- | --- |
| <code>systemd</code> → <code>hosted-compute-agent</code> <sub>pid&nbsp;1849</sub> | <code>140.82.113&#91;.&#93;23</code> |
| <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node</code> <sub>pid&nbsp;2361</sub><br><sub>step: &quot;Run workload&quot;</sub> | · <code>registry.npmjs&#91;.&#93;org</code><br>· <code>localhost</code> |
| <code>systemd</code> → <code>…</code> → <code>node</code> → <code>dash</code> → <code>node</code> <sub>pid&nbsp;2384</sub><br><sub>step: &quot;Run workload&quot;</sub> | · <code>registry.npmjs&#91;.&#93;org</code><br>· <code>api.garnet&#91;.&#93;ai</code><br>· <code>localhost</code><br>· <code>github&#91;.&#93;com</code> |
| <code>systemd</code> → <code>…</code> → <code>node</code> → <code>dash</code> → <code>curl</code> <sub>pid&nbsp;2396</sub><br><sub>step: &quot;Run workload&quot;</sub> | · <code>httpbin&#91;.&#93;org</code><br>· <code>localhost</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd811584691</code> <sub>pid&nbsp;1864</sub> | · <code>localhost</code><br>· <code>hosted-compute-watchdog-prod-iad-02&#91;.&#93;githubapp</code> |

<details><summary><sub>Execution chains · 11&nbsp;destination associations</sub></summary>

<pre>
systemd
└─ hosted-compute-agent
   └─ Runner.Listener
      └─ Runner.Worker
         └─ bash
            └─ <strong>node</strong> <em>(pid 2361)</em> <em>(step: &quot;Run workload&quot;)</em>
               ├─ ○ registry.npmjs&#91;.&#93;org [104.16.1&#91;.&#93;34] :443 (https) TCP
               └─ ○ localhost [127.0.0&#91;.&#93;53] :53 (dns) UDP

systemd
└─ hosted-compute-agent
   └─ Runner.Listener
      └─ Runner.Worker
         └─ bash
            └─ node
               └─ dash
                  └─ <strong>node</strong> <em>(pid 2384)</em> <em>(step: &quot;Run workload&quot;)</em>
                     ├─ ○ registry.npmjs&#91;.&#93;org [104.16.8&#91;.&#93;34] :443 (https) TCP
                     ├─ ○ api.garnet&#91;.&#93;ai [104.26.10&#91;.&#93;16] :443 (https) TCP <em>(garnet sensor)</em>
                     ├─ ○ localhost [127.0.0&#91;.&#93;53] :53 (dns) UDP
                     └─ ○ github&#91;.&#93;com [140.82.113&#91;.&#93;3] :443 (https) TCP

systemd
└─ hosted-compute-agent
   └─ Runner.Listener
      └─ Runner.Worker
         └─ bash
            └─ node
               └─ dash
                  └─ node
                     └─ dash
                        └─ <strong>curl</strong> <em>(pid 2396)</em> <em>(step: &quot;Run workload&quot;)</em>
                           ├─ ○ httpbin&#91;.&#93;org [100.52.37&#91;.&#93;185] :443 (https) TCP
                           └─ ○ localhost [127.0.0&#91;.&#93;53] :53 (dns) UDP

systemd
└─ <strong>hosted-compute-agent</strong> <em>(pid 1849)</em>
   └─ ○ 140.82.113&#91;.&#93;23 :443 (https) TCP

systemd
└─ hosted-compute-agent
   └─ sudo
      └─ <strong>provjobd811584691</strong> <em>(pid 1864)</em> <em>(ran from /tmp/…)</em>
         ├─ ○ localhost [127.0.0&#91;.&#93;53] :53 (dns) UDP
         └─ ○ hosted-compute-watchdog-prod-iad-02&#91;.&#93;githubapp [140.82.114&#91;.&#93;23] :443 (https) TCP · also recorded: glb-2a3c35-public-internal.githubapp&#91;.&#93;com <em>(github infra)</em>
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>140.82.113.23 :443 (https) TCP</code> | <code>systemd</code> → <code>hosted-compute-agent (pid 1849)</code> | step: 99. Runner Processes |
| <code>registry.npmjs.org [104.16.1.34] :443 (https) TCP</code> | <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node (pid 2361)</code> | step: 4. Run workload (${{ matrix.job&#95;name }}) · attention |
| <code>localhost [127.0.0.53] :53 (dns) UDP</code> | <code>systemd</code> → <code>…</code> → <code>Runner.Worker</code> → <code>bash</code> → <code>node (pid 2361)</code> | step: 4. Run workload (${{ matrix.job&#95;name }}) · attention |
| <code>registry.npmjs.org [104.16.8.34] :443 (https) TCP</code> | <code>systemd</code> → <code>…</code> → <code>node</code> → <code>dash</code> → <code>node (pid 2384)</code> | step: 4. Run workload (${{ matrix.job&#95;name }}) · attention |
| <code>api.garnet.ai [104.26.10.16] :443 (https) TCP</code> | <code>systemd</code> → <code>…</code> → <code>node</code> → <code>dash</code> → <code>node (pid 2384)</code> | step: 4. Run workload (${{ matrix.job&#95;name }}) · (garnet sensor) · attention |
| <code>localhost [127.0.0.53] :53 (dns) UDP</code> | <code>systemd</code> → <code>…</code> → <code>node</code> → <code>dash</code> → <code>node (pid 2384)</code> | step: 4. Run workload (${{ matrix.job&#95;name }}) · attention |
| <code>github.com [140.82.113.3] :443 (https) TCP</code> | <code>systemd</code> → <code>…</code> → <code>node</code> → <code>dash</code> → <code>node (pid 2384)</code> | step: 4. Run workload (${{ matrix.job&#95;name }}) · attention |
| <code>httpbin.org [100.52.37.185] :443 (https) TCP</code> | <code>systemd</code> → <code>…</code> → <code>node</code> → <code>dash</code> → <code>curl (pid 2396)</code> | step: 4. Run workload (${{ matrix.job&#95;name }}) |
| <code>localhost [127.0.0.53] :53 (dns) UDP</code> | <code>systemd</code> → <code>…</code> → <code>node</code> → <code>dash</code> → <code>curl (pid 2396)</code> | step: 4. Run workload (${{ matrix.job&#95;name }}) · attention |
| <code>localhost [127.0.0.53] :53 (dns) UDP</code> | <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd811584691 (pid 1864)</code> | step: 99. Runner Processes · attention |
| <code>hosted-compute-watchdog-prod-iad-02.githubapp [140.82.114.23] :443 (https) TCP · also recorded: glb-2a3c35-public-internal.githubapp.com</code> | <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd811584691 (pid 1864)</code> | step: 99. Runner Processes · (github infra) |

</details>

<details><summary><strong>Assertions</strong></summary>

| Check | Result | Context |
| --- | --- | --- |
| A process contacted a bad network domain. | `attention` | Network Egress · no&#95;bad&#95;egress&#95;domain |
| A program was executed, and then its file was deleted. | `pass` | Stealth · no&#95;binary&#95;execution&#95;and&#95;deletion |
| A process initiated code injection via /proc/{pid}/mem access. | `pass` | Privilege Escalation · no&#95;code&#95;injection&#95;via&#95;proc&#95;memory |

</details>

<div align="right">
<a href="https://app.garnet.ai/public/runs/29294366437?profile=019f5de7-5992-7409-89cf-6d88e0fb46ea&amp;utm_source=github&amp;utm_medium=step_summary">View this job's Execution Profile in Garnet →</a>
</div>
