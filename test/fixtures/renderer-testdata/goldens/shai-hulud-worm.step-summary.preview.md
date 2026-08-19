## Garnet Execution Summary

### Workload Summary

| Field | Value |
| --- | --- |
| Workflow | ci |
| Repository | garnet-labs/posthog |
| Commit | 7777777777777777777777777777777777777777 |
| Run ID / Job | 32100000007 / install |

### Network Egress Summary

Keyed by execution chain; repeated destination names within a chain are collapsed.

| Process Tree | Destinations |
| --- | --- |
| <code>systemd</code> → <code>Runner.Worker</code> → <code>npm</code> → <code>node</code> <sub>pid&nbsp;9001</sub> | <code>registry.npmjs.org</code> |
| <code>systemd</code> → <code>…</code> → <code>node</code> → <code>sh</code> → <code>bun</code> <sub>pid&nbsp;9107</sub> | · <code>api.github.com</code><br>· <code>169.254.169.254</code><br>· <code>release-assets.githubusercontent.com</code> |
| <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd</code> <sub>pid&nbsp;412</sub> | <code>resultsstorageeus2.blob.core.windows.net</code> |

<details><summary><sub>Full recorded tree</sub></summary>

<pre>
Runner.Worker
└─ npm
   └─ <strong>node</strong> <em>(step: &quot;Install&quot;)</em>
      ├─ sh
      │  └─ <strong>bun</strong>
      │     ├─ ○ 169.254.169.254 <em>(cloud metadata)</em>
      │     ├─ ○ api.github.com
      │     └─ ○ release-assets.githubusercontent.com
      └─ ○ registry.npmjs.org

systemd
└─ hosted-compute-agent
   └─ sudo
      └─ <strong>provjobd</strong>
         └─ ○ resultsstorageeus2.blob.core.windows.net
</pre>
</details>

<details><summary><strong>Recorded context preview</strong></summary>

| Destination | Process Tree | Context |
| --- | --- | --- |
| <code>registry.npmjs.org [104.16.30.34] :443 tcp</code> | <code>systemd</code> → <code>Runner.Worker</code> → <code>npm</code> → <code>node (pid 9001)</code> | step: 3. Install |
| <code>api.github.com [140.82.112.6] :443 tcp</code> | <code>systemd</code> → <code>…</code> → <code>node</code> → <code>sh</code> → <code>bun (pid 9107)</code> | step: 3. Install |
| <code>169.254.169.254 :443 tcp</code> | <code>systemd</code> → <code>…</code> → <code>node</code> → <code>sh</code> → <code>bun (pid 9107)</code> | step: 3. Install · (cloud metadata) |
| <code>release-assets.githubusercontent.com [185.199.108.133] :443 tcp</code> | <code>systemd</code> → <code>…</code> → <code>node</code> → <code>sh</code> → <code>bun (pid 9107)</code> | step: 3. Install |
| <code>resultsstorageeus2.blob.core.windows.net [20.60.153.129] :443 tcp</code> | <code>systemd</code> → <code>hosted-compute-agent</code> → <code>sudo</code> → <code>provjobd (pid 412)</code> | — |

</details>

<details><summary><strong>Assertions</strong></summary>

No assertions recorded.

</details>

<div align="right">
<sub>2026-08-07 18:30:00 UTC</sub><br>
<strong>Powered by Garnet</strong>
</div>

<sub><a href="https://github.com/garnet-labs/posthog/actions/runs/32100000007">Job summary generated at run-time</a></sub>
