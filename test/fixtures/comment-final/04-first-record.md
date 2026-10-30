<sub>v17.3 final shape · state 4: Runtime behavior recorded, nothing to compare yet · illustrative data, not a record · not a live App comment</sub>

### Runtime behavior recorded

> ***11 destinations*** *in 2 of 2 jobs*<br><sub>*head* `abc1234` · *nothing to compare yet*</sub><br><sub>*2 of 2 jobs recorded at the kernel (Linux X64)*</sub>

<details>
<summary><b>8 destinations · build</b><br><code>bash › node</code> reaches 6 destinations; <code>bash › curl</code> reaches 2</summary>

<blockquote>

```text
  Runner.Worker › bash
  ├─ node
  │  ├─ ○ registry.npmjs[.]org
  │  ├─ ○ nodejs[.]org
  │  ├─ ○ github[.]com
  │  ├─ ○ codeload.github[.]com
  │  ├─ ○ objects.githubusercontent[.]com
  │  └─ ○ api.github[.]com
  └─ curl
     ├─ ○ get.pnpm[.]io
     └─ ○ release-assets.githubusercontent[.]com
```

<sub><a href="JOB_URL">Job log</a> · <a href="PROFILE_URL">Full record in Garnet ↗</a></sub>
</blockquote>
</details>

<details>
<summary><b>3 destinations · lint</b><br><code>bash › node</code> reaches 3 destinations</summary>

<blockquote>

```text
  Runner.Worker › bash
  └─ node
     ├─ ○ registry.npmjs[.]org
     ├─ ○ nodejs[.]org
     └─ ○ github[.]com
```

<sub><a href="JOB_URL">Job log</a> · <a href="PROFILE_URL">Full record in Garnet ↗</a></sub>
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
