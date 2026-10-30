<sub>v17.3 final shape · state 1: changed, with gaps (recorded in part, process unknown, runner fold, not recorded) · illustrative data, not a record · not a live App comment</sub>

### Runtime behavior changed

> ***+5 destinations*** *in 2 of 6 jobs*<br><sub>*head* `9f3c2d1` *compared with* `e4f5a6b` *(previous push)*</sub><br><sub>*4 of 6 jobs recorded at the kernel (Linux X64), 1 in part*</sub>

<details>
<summary><b>+4 · build (ubuntu, node 22)</b><br><code>node › python3</code> now reaches <code>files.pythonhosted[.]org</code> and <code>pypi[.]org</code>; <code>bash › curl</code> now reaches 2 new destinations</summary>

<blockquote>

```diff
  Runner.Worker › bash
  ├─ node
+ │  └─ python3 · step "Build native addon"
+ │     ├─ ○ files.pythonhosted[.]org
+ │     └─ ○ pypi[.]org
  └─ curl · step "Download prebuilt binary"
+    ├─ ○ objects.githubusercontent[.]com
+    └─ ○ release-assets.githubusercontent[.]com

  process unknown
  ├─ ○ registry.npmjs[.]org
  └─ ○ nodejs[.]org
```

<blockquote>
<details>
<summary>Runner, outside your workflow · −2</summary>

```text
  systemd › hosted-compute-agent › sudo
- └─ provjobd
-    └─ ○ 140.82.112[.]24

  systemd
- └─ systemd-networkd
-    └─ ○ ip6-allrouters
```

</details>
</blockquote>

<sub><em>Recorded in part: the recorder started after step 6 began, so 2 connections have no known process</em> · 17 other destinations unchanged · <a href="JOB_URL">Job log</a> · <a href="PROFILE_URL">Full record in Garnet ↗</a></sub>
</blockquote>
</details>

<details>
<summary><b>+1 · test (ubuntu-24.04, node 20)</b><br><code>bash › curl</code> now reaches <code>get.pnpm[.]io</code></summary>

<blockquote>

```diff
  Runner.Worker › bash
  └─ curl · step "Install pnpm"
+    └─ ○ get.pnpm[.]io
```

<sub>8 other destinations unchanged · <a href="JOB_URL">Job log</a> · <a href="PROFILE_URL">Full record in Garnet ↗</a></sub>
</blockquote>
</details>

<details>
<summary>2 jobs · nothing new</summary>

<blockquote>
<sub><a href="JOB_URL">lint</a> · 6 destinations<br><a href="JOB_URL">test (ubuntu-24.04, node 22)</a> · 9 destinations</sub>
</blockquote>
</details>

<details>
<summary>2 jobs not recorded</summary>

<blockquote>
<sub><em>Linux runners only</em> · <a href="JOB_URL">test (macos-14, node 22)</a> · <a href="JOB_URL">test (macos-14, node 20)</a></sub>
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

<sub>Runtime behavior, recorded by Garnet. <a href="https://app.garnet.ai/onboarding?utm_source=github&amp;utm_medium=pr_comment&amp;utm_content=add_to_ci">Add it to your CI ↗</a></sub>
