# Tokenless path for the Garnet Action — design spec (draft)

Status: **draft for review** — no product code changes in this PR.

Tracking: [ENG-1329](https://linear.app/garnet-labs/issue/ENG-1329/tokenless-path-for-github-action)
(tokenless path) and the fallback half of
[ENG-1346](https://linear.app/garnet-labs/issue/ENG-1346) (simpler comment
shape + token-optional local-only fallback). Sequenced against
[ENG-1355](https://linear.app/garnet-labs/issue/ENG-1355) (v6.x renderer port
to this repo; ENG-1345 was canceled into it). Contract of record:
`garnet-org/runtime-review-testbed` `docs/ux-contract.md` **v6.1** (testbed
PRs #52/#53/#55/#59). Prior analysis: Devin session
`022557ef6b7d4534b9c5085147f23d67` (`token-optional-and-plg-review.md`) and
testbed `docs/step-summary.md` §"Tokenless-by-default fallback".

## 1. Motivation (PLG: value before signup)

Today `api_token` is `required: true` and the main step throws when it is
empty (`src/action.js` — "Input 'api_token' is required…"). The two biggest
consequences:

- **Adoption friction**: a user must sign up, create a project, copy a token,
  and add a repo secret *before first value*. The README one-liner cannot be
  a one-liner.
- **Fork PRs always fail**: forks never receive repository secrets, so the
  action degrades to "no runtime monitoring" on exactly the PRs where an
  OSS maintainer most wants runtime evidence.

The goal: `uses: garnet-org/action@v2` with **no inputs** produces a complete
local Runtime Review — GitHub Step Summary always, standalone PR comment when
`github_token` permits — rendered entirely from Jibril's local JSON profile,
with **zero control-plane dependency**. The token *upgrades* the experience
(hosted Run Profile, managed policies, GitHub App comment, dashboard history)
instead of gating it.

Forward-compatibility note from product direction: Run Profile reports in the
UI will later be **always private**. The public/step-summary value must
therefore be producible through this local path — the tokenless output is not
a temporary degraded mode but the permanent public surface of the action.

## 2. What actually requires the control plane today

Audit of `src/main.js`, `src/action.js`, `src/post.js`:

| Step | Where | Control plane? | Notes |
| --- | --- | --- | --- |
| Jibril binary download | `action.js` (`jibril-releases` on GitHub) | **No** | Public GitHub release asset |
| Agent creation (`createAgent`) | `action.js` → `ControlPlaneClient` | **Yes** | Produces `AGENT_ID` + `AGENT_TOKEN`; also what triggers the GitHub App comment server-side |
| Network policy fetch (`mergedNetPoliciesAsYAML`) | `action.js` | **Yes** | Written to `/etc/jibril/netpolicy.yaml`, replacing Jibril's bundled default |
| `/etc/default/jibril` env file | `action.js` | Partly | Embeds `GARNET_API_TOKEN` / `GARNET_AGENT_TOKEN`; `GARNET_SAR=true` is already the default |
| Jibril systemd run + profile JSON | `action.js` / Jibril | **No** | Profiler printers write `/var/log/jibril.profile.json` locally regardless |
| Sensor upload to api.garnet.ai | Jibril (garnet printer) | **Yes** | Requires agent token; degrades gracefully without one |
| `report_url` output (Run Profile permalink) | `main.js` `buildReportLink` | **Yes** (semantically) | URL is derivable offline, but the target only exists if the profile was uploaded |
| Step Summary render | `post.js` → `runtime-review.js` | **No** | Reads local JSON profile only |
| Standalone PR comment | `post.js` → `pr-comment.js` | **No** | Needs only `GITHUB_TOKEN` with `pull-requests: write` |
| `agent_id` output | `action.js` | **Yes** | No agent exists without registration |

Conclusion (matches the prior session's finding): the token has exactly three
uses — agent registration, netpolicy fetch, and the sensor's own upload. The
entire post-step rendering pipeline is already local.

Jibril itself already supports this: the action sets `GARNET_SAR=true` by
default, which puts Jibril in offline-agent mode (no registration required),
and Jibril ships a bundled default `netpolicy.yaml`. No Jibril or
control-plane changes are required for phase 1.

## 3. Input changes

`action.yaml`:

```diff
 inputs:
     api_token:
-        description: "Your Garnet API token from app.garnet.ai"
-        required: true
+        description: "Your Garnet API token from app.garnet.ai. Optional: without it the action runs in local-only mode (Step Summary + PR comment from the local profile, no hosted Run Profile)."
+        required: false
```

(Note: GitHub does not enforce `required: true` for actions — the real gate
is the throw in `src/action.js`. That throw becomes the local-mode branch;
the misconfiguration message about fork PRs moves to an informational log.)

## 4. Behavior matrix

Two axes: token presence × comment ownership (companion GitHub App installed
vs standalone).

| `api_token` | App installed | Main step | Post step |
| --- | --- | --- | --- |
| present, valid | yes | register agent, fetch merged netpolicy, cloud sync | Step Summary; action defers the PR comment to the App (unchanged) |
| present, valid | no | same | Step Summary + standalone PR comment + Run Profile permalink (unchanged) |
| **absent** | yes\* | log "local-only mode"; skip registration + netpolicy fetch; Jibril bundled default policy, observe-only; omit token lines from `/etc/default/jibril` | Step Summary + standalone PR comment, **local shape** (§5): no garnet permalink, labeled local-only, upgrade CTA |
| **absent** | no | same | same |
| present, **invalid** (control-plane call fails auth) | — | **fail loudly** (warning + no monitoring, as today) — misconfiguration is not tokenless intent | no local fallback: a configured token that stops working should be visible, not silently downgraded |

\* Without a token there is no agent registration, so the control plane never
learns about the run and the App never posts — "App installed" is
indistinguishable from standalone in tokenless mode. The action posts the
standalone comment. If the App is installed *and* other tokened workflows on
the same PR report through it, two comments can coexist (see open question
Q3).

Other deltas in tokenless mode:

- `report_url` output: **empty string** (contract rule: omit rather than
  mislabel — a permalink to a profile that was never uploaded is a dead
  link). Consumers must treat it as optional.
- `agent_id` output: empty string.
- Fork PRs automatically become tokenless runs instead of failures — the
  current "commonly happens on pull requests from forks" error path is
  replaced by the local-only mode.

## 5. Output shape without the control plane

The v6.1 contract (`ux-contract.md`) is the single source of truth for both
surfaces; the tokenless path must **not** fork it silently. What changes is
exactly the set of elements whose referent does not exist:

- **Garnet permalink** (`View Run Profile in Garnet ↗`, §1.1/§1.7/§8.6):
  omitted. The contract already contains the governing rule — *omit rather
  than mislabel*. Per-fold subtext and the Step Summary footer instead carry
  a single upgrade CTA, e.g.
  `<sub>local-only run — connect Garnet for the hosted Run Profile ↗</sub>`
  linking to app.garnet.ai signup (utm-tagged, `utm_medium=pr_comment` /
  `step_summary`).
- **A labeled local-only marker**: one line in the meta/footer area stating
  the run was recorded locally and nothing left the runner. Honesty rule:
  nobody should assume central detection coverage they do not have.
- **Everything else is byte-identical**: meta line, explainer, job folds,
  canonical trees, classification, notability, noun rules, zero-egress line,
  size budget, Step Summary tables, assertions fold. Same renderer module,
  one boolean of input (`hosted: false` / permalink-absent), not a second
  shape.

### Contract implication — explicit recommendation (ENG-1346 A/B)

**Recommend Option B-flavored sequencing with a defined trigger, executed as
a v6.x amendment (not a new "local shape"):**

1. v6.1 ships as ratified; ENG-1355 ports it to this repo unchanged. The
   tokenless path does **not** block or amend that tag.
2. The tokenless variant is proposed as a **v6.2 amendment** in the testbed
   (new gates: permalink-absent variant, CTA vocab lock, local-only marker
   string), ratified before any action code renders it. The trigger for the
   amendment is this spec's approval — that is the "written trigger" ENG-1346
   Option B requires.
3. It is one contract with a conditional element, not a fork: the CTA label
   and local-only marker enter the §1.1 vocab lock so the strings cannot
   drift between action, docs, and future surfaces.

The "table, no verdicts" half of ENG-1346 is out of scope here; nothing in
this spec depends on which shape wins, because the tokenless delta is
confined to permalink/CTA/marker elements that exist in either shape.

## 6. Implementation sketch (phase 1, this repo only)

- `action.yaml`: `api_token` → `required: false` (§3).
- `src/action.js`: when `TOKEN === ""`, branch to local mode — skip
  `createAgent` and `mergedNetPoliciesAsYAML`, keep Jibril's bundled
  `/etc/jibril/netpolicy.yaml`, write `/etc/default/jibril` without the
  `GARNET_API_TOKEN`/`GARNET_AGENT_TOKEN` lines (keep `GARNET_SAR=true`),
  and `core.saveState("localOnly", "true")`.
- `src/main.js`: emit `report_url` only when a token is present.
- `src/post.js` / renderers: thread the local-only flag into render options;
  permalink slots render the CTA per the ratified v6.2 amendment.
- Golden tests for the tokenless variant mirroring the testbed gates;
  `dist/` rebuild via ncc.

Estimated size: small-medium PR (~200–400 lines src + goldens + dist),
**after** the ENG-1355 port lands (otherwise the renderer work is done twice
against two shapes).

## 7. Security considerations

- **Strictly better data posture**: in tokenless mode nothing leaves the
  runner — no registration, no upload, no telemetry. Worth stating in README
  and the local-only marker.
- **Observe-only default policy**: the bundled netpolicy must stay
  observe/alert-only. A tokenless run must never block egress surprisingly —
  policy enforcement is a tokened, centrally-managed capability.
- **Secrets hygiene improves**: `/etc/default/jibril` (mode 600, deleted in
  post) no longer contains any Garnet credential in tokenless mode.
- **Fork PR comments**: standalone comments already depend on the workflow's
  `github_token` permissions; `pull_request` from forks gets a read-only
  token, so the comment is skipped (existing behavior) and the Step Summary
  still carries the review. No new privilege is requested.
- **Invalid ≠ absent**: an explicitly provided token that fails auth must
  not silently fall back to local mode (silent downgrade would mask
  credential expiry/revocation and could be induced by an attacker who can
  corrupt the secret). Fail loudly, as today.
- **No spoofing surface added**: tokenless runs write nothing to the control
  plane, so there is no anonymous-ingestion abuse vector in phase 1. (Phase
  2 — GitHub OIDC-verified anonymous ingestion for public repos — is where
  that analysis lives; explicitly out of scope here.)

## 8. Migration & rollout

1. **Precondition**: ENG-1346 shape decision recorded; ENG-1355 (v6.x port,
   v2.3.0) merged and released.
2. Testbed v6.2 amendment PR (permalink-absent variant + CTA/marker vocab +
   gates) ratified and tagged.
3. Action PR implementing §6; goldens pinned to the v6.2 tag; dist rebuilt.
4. Release **v2.4.0**, move floating `v2`. Fully backward compatible: every
   existing workflow passes a token and sees zero change.
5. README: move "get your token" from prerequisite to upgrade step; document
   local-only mode and fork behavior (coordinate with PR #97's README/GH-App
   restructuring to avoid conflicting edits).
6. Known cost: no server-side adoption telemetry for tokenless users —
   measure via Marketplace installs / README traffic instead.

## 9. Open questions

1. **CTA vocab**: exact locked strings for the upgrade CTA and the
   local-only marker (needs the same one-label-one-destination discipline as
   `View Run Profile in Garnet ↗`).
2. **Waiting state**: the tokenless standalone comment renders only from the
   post step of each job — is the §2 waiting body reachable/needed at all in
   tokenless mode, or is the comment only ever created at first profile?
3. **App + tokenless coexistence**: when the App is installed but a
   tokenless workflow also runs, do we accept two comments, or should the
   action attempt App-comment detection (marker scan) before posting?
4. **`jibril_version` pinning**: tokenless users get the bundled default
   netpolicy of whatever Jibril version resolves — do we need a minimum
   version gate for a known-good observe-only default?
5. **Phase 2 trigger**: what evidence (Marketplace installs? fork-PR volume?)
   promotes the OIDC anonymous-ingestion work from direction to committed
   scope?
