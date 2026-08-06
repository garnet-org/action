# Public Run Profile — v6.4.0 contract mockup (generated)

Generated from the vocabulary lock by render-states-real.mjs — do not hand-edit.

## Routes

- Run index: `/public/runs/{run_id} — no logged-out projection without an exact ?profile selector`
- Exact profile selector: `/public/runs/{run_id}?profile=<profile_id>`
- `?job=`: ?job= is not a public profile selector and never authorizes a logged-out projection
- Selector miss: an absent, empty, or wrong profile ID returns 404 — never a silent fallback to run index/job/first profile

## Publication policy (fail-closed, rechecked at request time)

- Default: deny (404)
- Render: only when backend-truth repository visibility is exactly 'public' AND explicit publication consent exists AND consent is not revoked AND an exact envelope Profile.ID selector resolves, rechecked at request time
- Denied states: private, internal, unknown, revoked, unconsented, visibility-flipped-to-private, missing-profile-selector, empty-profile-selector, wrong-profile-selector, job-only-selector
- all denied cases return the same 404 for HTML and JSON
- JSON/HTML responses are not long-lived CDN cached

## Losslessness

- the canonical public Run Profile is untruncated; UI folding/virtualization must be lossless

## This repository

- this repository is private — its logged-out permalink correctly 404s; positive public-link acceptance requires a separate public, explicitly consented fixture repository

> The record is egress-centric; processes without recorded egress do not appear.
