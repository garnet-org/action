<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
## Garnet Runtime Review
[`ef01a52`](https://github.com/garnet-labs/runtime-review-testbed/commit/ef01a52517e7532ab34aadea58b952c9f1e79ece) · 1 of 1 job recorded · updated 14:02 UTC · Jul 3

In `runtime-review`, 9 processes reached 4 domains over 5 connections.

<details><summary><b><code>runtime-review</code></b> — reached <code>github.com</code>, <code>images.unsplash.com</code>, <code>registry.npmjs.org</code> and 1 more · 5 connections</summary>

````text
runtime-review
└─ GitHub runner ┄ 4 processes
   └─ bash
      ├─ npm test
      │  └─ sh
      │     └─ node
      │        ├─ → api.garnet.ai · 104.26.11.16 — garnet upload
      │        ├─ → images.unsplash.com · 146.75.94.208
      │        ├─ → registry.npmjs.org · 104.16.8.34
      │        └─ → github.com · 140.82.113.3
      └─ npm install
         └─ → registry.npmjs.org · 104.16.8.34
````

<sub>Paste the tree into your review agent · full detail in the Step Summary · [job log ↗](https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28492112239)</sub>

</details>

---
<sub>What happened in this PR — each job's processes and where they reached. · [Run Profile ↗](https://app.garnet.ai/p/runtime-review-testbed)</sub>
