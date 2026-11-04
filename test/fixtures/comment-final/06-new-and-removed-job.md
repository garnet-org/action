<sub>v17.3 final shape · state 6: a new job, and a job no longer in this commit · illustrative data, not a record · not a live App comment</sub>

### Runtime behavior changed

> ***1 new job · 2 destinations*** *· nothing new in the other 2 jobs*<br><sub>*head* `e8b4f21` *compared with* `5d2a9e0` *(previous push)*</sub><br><sub>*3 of 3 jobs recorded at the kernel (Linux X64)*</sub>

<details>
<summary><b>new job · docs</b><br><code>bash › npx</code> reaches <code>registry.npmjs[.]org</code> and <code>unpkg[.]com</code></summary>

<blockquote>

```text
  Runner.Worker › bash
  └─ npx · step "Build docs"
     ├─ ○ registry.npmjs[.]org
     └─ ○ unpkg[.]com
```

<sub>2 destinations, nothing to compare · <a href="JOB_URL">Job log</a> · <a href="PROFILE_URL">Full record in Garnet ↗</a></sub>
</blockquote>
</details>

<details>
<summary>2 jobs · nothing new</summary>

<blockquote>
<sub><a href="JOB_URL">build</a> · 21 destinations<br><a href="JOB_URL">test</a> · 9 destinations</sub>
</blockquote>
</details>

<details>
<summary>1 job not in this commit</summary>

<blockquote>
<sub><em>Was recorded on</em> <code>5d2a9e0</code> · <a href="PROFILE_URL">lint ↗</a></sub>
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
