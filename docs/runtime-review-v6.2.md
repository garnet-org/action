# Runtime Review v6.2 — historical record of the v6.1 → v6.2 step

Status: **superseded.** The contract has moved to v6.10.0. This page is kept
for the reasoning behind the v6.2 step, not as a description of what the
action renders today.

Contract source of truth: `garnet-org/runtime-review-testbed`
`contract/vocab.json` **6.10.0** + `docs/ux-contract.md`. The testbed's
byte-gated goldens are the spec. This action's renderer
(`src/runtime-review.js`) is a port of the testbed reference renderer and
vendors the contract byte-identically as `src/runtime-review-vocab.js`; read
that file for the strings the renderer actually emits.

## What v6.10.0 says instead

Everything in the "What changed in the PR comment" section below is
superseded. The current shape:

- Headline: `**Execution Profiles recorded for N job(s), triggered by
  <sha7>**` — bold body text, no heading, no product name.
- Meta block: two blockquote lines. The italic finding line first (the
  destination total, or the job segments and `compared with <sha7>`, or
  `No changes since <sha7>`), then one quiet line
  `recorded at the kernel by Garnet · <timestamp>` at minute precision. The
  words `as of` no longer render.
- One fold per job, one block per fold, holding every recorded root of that
  job. Fold rows carry `· N destination(s)`; changed rows lead with a bold
  `+A −R` split that counts your workflow's destinations. Movement in the
  runner's background is counted by a `(runner background · +A −B)` label on
  the root above those marks.
- Observed actions render as `○ <destination>` leaves. The explainer teaches
  one execution chain: a path from a root down to an observed action.
- Fold summaries carry counts and identity only — the `reached` sentence is
  gone.

## Two surfaces, one renderer

- **PR comment** — a shared conversation surface. Curated, glanceable,
  observation-only: it answers "what happened?", never "is this good?". No
  verdict vocabulary, status icons, badges, or rankings anywhere.
- **Step Summary** — the per-run record, read by the person who ran the job.
  It is a faithful, readable projection of the Run Profile artifact: could you
  reconstruct the profile's story from it? That is the test it must pass.

## What changed in the PR comment (v6.1 → v6.2) — superseded, see above

- Marker block: canonical marker, self marker, then `<!-- garnet:commit {full sha} -->`.
- Actor-conditional heading: standalone mode (this action, `github-actions[bot]`)
  keeps the `### Garnet Runtime Review` h3; the App-installed path renders
  headerless (the bot actor row carries the brand).
- Invariant headline, byte-locked:
  `**See what ran** — every process your jobs executed, and where they connected`.
- Provenance line on one quote rail:
  `> <sub>*commit [sha7](url) · recorded at the kernel · as of {stamp}*</sub>`
  (waiting variant: `no jobs recorded yet as of {stamp}`). No coverage fraction.
- 💡 explainer rewritten to the A-format annotated mini-tree (lineage-exact,
  with ← teaching labels, legend, and notes); open through the first-commit
  lifecycle only.
- Jobs-count separator line: `<sub><i>{N} jobs recorded on this commit</i></sub>`
  — `{k} of {n}` only when 0 < k < n, `across {w} workflows` only when w > 1,
  absent in the waiting state.
- Job fold summaries use the verb **reached** (never `contacted`).

## Step Summary: delta vs Djalal's markdown printer (jibril) — v6.2 shape

Djalal's most recent Go markdown printer (`pkg/printers/profiler/markdown.go`,
"Garnet - Runtime Report") was destination-first and full-fidelity: Profile
UUID, verbatim `assertion_id`s, per-assertion DETECTIONS tables, PIDs, full
telemetry — but it also carried verdict framing (✅/❌ headline, per-row status
icons, bad-first sorting) and a lossy remote-name dedupe ("omitted
destinations").

The v6.2 Step Summary restored Djalal's faithful-record shape while removing
only the verdict framing. The v6.10.0 Step Summary keeps that intent, but the
table is lineage-first (`Process Tree | Destinations`), not the
destination-first table described here:

- Egress table is **destination-first** (`Destination | Port | Lineage Tree`),
  one row per recorded destination in the profile's own
  `network.egress.peers[]` order — the profile's own shape. PIDs render as
  `<sub>pid N</sub>` in the lineage tree. Grouping is non-lossy (×N, address
  lists); nothing is deduped-and-omitted.
- `Garnet Profile UUID` is the first Workload Summary row.
- Telemetry sentence carries the full figures: domains, destinations,
  connections, and flows ("omitted" is dropped — structurally zero).
- No ✅/❌ headline, no status columns, no bad-first sort in the default
  surface.

## Preview vs prod (assertions & evidence gating)

One renderer, one boolean — the `preview` action input (default `false`):

- **Prod (default)** — the observation-only record: Workload Summary,
  destination-first Network Egress, telemetry sentence, permalink footer.
  No Assertions fold, no Evidence, no status vocabulary anywhere.
- **Preview (`preview: true`)** — adds the full-fidelity assertions record:
  a collapsed `Assertions` fold (plain — no "· beta") with verbatim
  `assertion_id`s and verbatim result enums (status icons confined to the
  fold), plus per-assertion `Evidence · {assertion_id}` folds for every class
  carrying events.

The preview shape is unstable and may change without a major version bump; it
is deliberately kept out of the quick-start docs. Both modes are byte-gated
with their own fixtures so prod bytes cannot drift while preview evolves.

## Vocab drift: jibril and ashkaal

The action renders from the JSON Run Profile, so jibril's own Go markdown
printer output ("Garnet - Runtime Report", ✅/❌ headline, `contacted`) is no
longer user-visible through this action — no runtime coupling breaks. If that
printer's output resurfaces on a user-facing path, it should adopt the
contract strings vendored in `src/runtime-review-vocab.js`. Ashkaal is the schema layer (field names) and is untouched by
renderer vocabulary.
