# Bugbot review guidelines

## Skip generated output

`dist/` holds the ncc bundles built from `src/` by `npm run build`. GitHub downloads an action and
executes it as a complete, self-contained package, and never installs dependencies on the runner,
so every required package (`@actions/core`, `@actions/github`, and the rest) must be bundled into
`dist/` and committed.

Do not review, comment on, or report findings in `dist/`. Review the corresponding `src/` files
instead. Staleness is already enforced by the `Verify dist/ is up to date` step in
`.github/workflows/ci.yaml`, so there is no need to flag it in review.
