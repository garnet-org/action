<sub>v17.3 final shape · state 5: workload nothing new, only runner activity changed · illustrative data, not a record · not a live App comment</sub>

### No runtime changes

> ***Nothing new*** *in 2 of 2 jobs*<br><sub>*head* `5d2a9e0` *compared with* `7c1e0b9` *(previous push)*</sub><br><sub>*2 of 2 jobs recorded at the kernel (Linux X64)*</sub>

<details>
<summary>build · nothing new<br>Only runner activity outside your workflow changed</summary>

<blockquote>
<blockquote>
<details>
<summary>Runner, outside your workflow · +1 −1</summary>

```text
  systemd › hosted-compute-agent › sudo
  └─ provjobd
-    ├─ ○ 140.82.112[.]24
+    └─ ○ 140.82.113[.]3
```

</details>
</blockquote>

<sub>21 destinations unchanged · <a href="JOB_URL">Job log</a> · <a href="PROFILE_URL">Full record in Garnet ↗</a></sub>
</blockquote>
</details>

<details>
<summary>1 job · nothing new</summary>

<blockquote>
<sub><a href="JOB_URL">lint</a> · 6 destinations</sub>
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
