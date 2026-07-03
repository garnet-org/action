<!-- garnet-runtime-review -->
<!-- garnet-run-profile -->
## Garnet Runtime Review
[`f49a847`](https://github.com/garnet-labs/runtime-review-testbed/commit/f49a8476ccfe33c72428d0c471093a1c84f40124) · 2 of 2 jobs recorded · updated 14:02 UTC · Jul 3

In `runtime-review`, `node` reached `github.com` — a destination no other job in this run reached.

<details open><summary><b><code>runtime-review</code></b> — reached <code>github.com</code>, <code>images.unsplash.com</code>, <code>registry.npmjs.org</code> and 1 more · 5 connections</summary>

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
      └─ ┄ 1 more destination · 1 connection — full tree in the Step Summary ↗
````

<sub>Paste the tree into your review agent · full detail in the Step Summary · [job log ↗](https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28492112239)</sub>

</details>

<details><summary><b><code>runtime-review</code></b> — reached <code>registry.npmjs.org</code> and 1 more · 2 connections</summary>

````text
runtime-review
└─ GitHub runner ┄ 4 processes
   └─ bash
      └─ node
         ├─ → registry.npmjs.org · 104.16.5.34
         └─ → dns · 127.0.0.53
````

<sub>Paste the tree into your review agent · full detail in the Step Summary · [job log ↗](https://github.com/garnet-labs/runtime-review-testbed/actions/runs/28488074733)</sub>

</details>

---
<sub>What happened in this PR — each job's processes and where they reached. · [Run Profile ↗](https://app.garnet.ai/p/runtime-review-testbed)</sub>
