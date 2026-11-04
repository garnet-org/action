# Relay envelope golden

`relay-envelope.json` is the exact `serializeRunArtifact(buildRunArtifact(...))`
content the Action produced before the PR-comment renderer was removed, for
the fixed agent, stop signal and `synthetic/credential-argv.json` profile in
`test/dist-surface.test.js`. The Garnet App reads this `garnet-run-*`
artifact to post the comment on fork PRs, so its bytes must not change.
Regenerate only for an intentional, App-coordinated format change.
