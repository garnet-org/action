<sub>v17.3 final shape · state 7: jobs still running · illustrative data, not a record · not a live App comment</sub>

### Recording runtime behavior

> ***2 of 4 jobs*** *finished so far*<br><sub>*head* `3a7f6c2` · *compared with* `e8b4f21` *(previous push) once every job finishes*</sub><br><sub>*recording at the kernel (Linux X64)*</sub>

<sub>Last result, on <code>e8b4f21</code>: 1 new job · 2 destinations · nothing new in the other 2 jobs</sub><br><sub>This comment updates when the remaining jobs finish.</sub>

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
