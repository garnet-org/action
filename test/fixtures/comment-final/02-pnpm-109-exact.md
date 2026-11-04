<sub>v17.3 final shape · state 2: one job changed · pnpm fork PR 109 · exact record (OS/arch omitted: not checked in the raw record) · not a live App comment</sub>

### Runtime behavior changed

> ***+1 −1 destinations*** *in 1 of 1 job*<br><sub>*head* `8a8a358` *compared with* `a982d31` *(previous push)*</sub><br><sub>*1 of 1 job recorded at the kernel*</sub>

<details>
<summary><b>+1 −1 · bootstrap-routing</b><br><code>bash › node</code> now reaches <code>cdn.npmmirror[.]com</code>, no longer <code>registry.npmjs[.]org</code></summary>

<blockquote>

```diff
  Runner.Worker › … (1) › bash
  └─ node · step "1. First run of the Corepack entry point"
+    ├─ ○ cdn.npmmirror[.]com
-    └─ ○ registry.npmjs[.]org
```

<blockquote>
<details>
<summary>Runner, outside your workflow · +1</summary>

```text
  systemd
    ├─ systemd-networkd
    │  └─ ○ ip6-allrouters
    ├─ systemd-resolved
    │  └─ ○ 168.63.129[.]16
    ├─ … (1)
    │  └─ python3.12
    │     └─ ○ 168.63.129[.]16
+   └─ … (2)
+      └─ provjobd1403145159
+         └─ ○ 20.75.202[.]224
```

</details>
</blockquote>

<sub><a href="https://github.com/garnet-labs/pnpm/actions/runs/37888539480/job/113683960175?utm_source=github&amp;utm_medium=pr_comment&amp;utm_campaign=pnpm-pr109&amp;utm_content=job">Job log</a> · <a href="https://app.garnet.ai/public/runs/37888539480?profile=01a11f20-e84a-7848-988d-627f113bf0f8&amp;utm_source=github&amp;utm_medium=pr_comment&amp;utm_campaign=pnpm-pr109&amp;utm_content=execution_profile">Full record in Garnet ↗</a></sub>
</blockquote>
</details>

---

<details>
<summary><sub>How to read this</sub></summary>

<blockquote>
<pre>
Runner.Worker     <em>← process on a path</em>
└─ <b>curl</b>           <em>← process that acted</em>
   └─ ○ example[.]com <em>← observed action</em>
</pre>

<sub>Read down: what ran, then what it reached. <b>+</b> only in this commit · <b>−</b> only in the compared run. Capture is best-effort. · <a href="https://docs.garnet.ai/execution-profile?utm_source=github&amp;utm_medium=pr_comment&amp;utm_content=docs#reading-the-comment">Docs ↗</a></sub>
</blockquote>
</details>

<sub>Runtime behavior, recorded by Garnet. <a href="https://app.garnet.ai/onboarding?utm_source=github&amp;utm_medium=pr_comment&amp;utm_campaign=pnpm-pr109&amp;utm_content=add_to_ci">Add it to your CI ↗</a></sub>
