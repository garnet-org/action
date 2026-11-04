# Bugbot review guidelines

## Skip generated output

`dist/` holds the ncc bundles built from `src/` by `npm run build`. GitHub downloads an action and
executes it as a complete, self-contained package, and never installs dependencies on the runner,
so every required package (`@actions/core`, `@actions/github`, and the rest) must be bundled into
`dist/` and committed.

Do not review, comment on, or report findings in `dist/`. Review the corresponding `src/` files
instead. Staleness is already enforced by the `Verify dist/ is up to date` step in
`.github/workflows/ci.yaml`, so there is no need to flag it in review.

## Runtime Review wording

The Action renders the Step Summary only; flag any PR-comment rendering added to `src/` (the Garnet App posts
the comment, fork PRs included, from the `garnet-run-*` relay artifact). Step Summary wording is vendored from `garnet-org/runtime-review-testbed` `main`
(`contract/vocab.json`) and enforced by `test/wording-gate.test.js`. Flag new user-facing copy that
bypasses `src/runtime-review-vocab.js`, adds emoji or outcome words (detected, verified, caught,
safe), or prints a detection label without the `show_detections` opt-in.
