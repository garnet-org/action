# Garnet — Runtime Visibility for GitHub Actions

<div align="center">
  <a href="https://garnet.ai">
    <img src="https://garnet.ai/wp-content/uploads/2023/06/logo_dark.svg" alt="Garnet" width="200" height="40">
  </a>
  <p><strong>Runtime visibility for your GitHub Workflows.</strong></p>
  <p>
    <a href="https://app.garnet.ai">Dashboard</a> ·
    <a href="https://jibril.garnet.ai">Jibril</a> ·
    <a href="https://app.garnet.ai">Get an API token</a>
  </p>

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![GitHub Marketplace](https://img.shields.io/badge/marketplace-Garnet-purple?logo=github)](https://github.com/marketplace/actions/garnet)
</div>

Garnet profiles every workflow run using Jibril, an eBPF sensor that attaches
to your CI runner. Every process spawn and outbound connection is captured with
full process lineage and surfaced in-line with pass / fail status of assertions.

One YAML step. No code changes. Works on `ubuntu-latest`.

```yaml
- uses: garnet-org/action@v2
  with:
    api_token: ${{ secrets.GARNET_API_TOKEN }}
```

Get your API token at [app.garnet.ai](https://app.garnet.ai)

---

## What you get

**A behavioral profile of every run.**
Jibril captures every process spawn and outbound connection during your
workflow — with full lineage tracing which parent spawned which child,
all the way down to the exact binary that opened the connection.

**Runtime assertions in your PR.**
Results appear as a step summary, PR comment: a summary table per job with assertion
results (pass / fail) and an egress table with process lineage inline. A permalink takes you to the Garnet UI for detailed investigation.

Assertions are a general framework and will expand over time. Think of them as
unit tests for runtime behavior based on invariants. The first shipped assertion
family is `known_bad_egress`, and future assertion families can cover invariants
like hidden ELF binary execution and other suspicious execution patterns.

**Lineage-first evidence.**
When something unexpected runs, you don't get a domain name — you get
the full chain:

```
npm install → dep@1.2.3 postinstall → bash → curl → unknown-domain.com
```

---

## Quickstart

1. Create an account at [app.garnet.ai](https://app.garnet.ai)
2. Generate an API token
3. Add `GARNET_API_TOKEN` to your repository secrets
4. Add Garnet as a step in any workflow:

```yaml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: garnet-org/action@v2
        with:
          api_token: ${{ secrets.GARNET_API_TOKEN }}

      - name: Your existing steps
        run: npm test
```

---

## Configuration

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api_token` | Yes | — | Your Garnet API token from app.garnet.ai |
| `github_token` | No | `${{ github.token }}` | GitHub token used for pull request comments |
| `api_url` | No | `https://api.garnet.ai` | Garnet API base URL |
| `garnetctl_version` | No | `latest` | Garnet CLI version (`1.2.3` or `latest`) |
| `jibril_version` | No | `""` (auto) | Jibril version (`v2.10.8` or `latest`) |
| `profiler_4fun` | No | `false` | Enable profiler 4 fun mode |
| `debug` | No | `false` | Enable debug mode and upload logs as artifacts |

## Outputs

| Output | Description |
|--------|-------------|
| `profile_result` | Assertion result: `pass` or `fail` |
| `report_url` | Full run report on app.garnet.ai |
| `agent_id` | Jibril sensor instance identifier |

---

## What assertions mean

Assertions act like unit tests for runtime behavior:
- Each assertion checks an invariant about what should or should not happen.
- Current status labels reflect the first shipped assertion family (`known_bad_egress`).
- Additional assertion families can cover invariants like hidden ELF binary execution.

| Status | Meaning |
|--------|---------|
| ✅ pass | No known-bad domains detected |
| 🔴 fail | Connection to known-bad domain — full lineage attached |

[Understanding your PR comment →](https://docs.garnet.ai)

---

## Why runtime visibility matters

Your team reviews the code. Your CI runs it. Between `git push` and
production, dependencies execute postinstall scripts, AI-generated functions
spawn processes, and build steps make outbound connections — none of which
appear in a static scan.

Garnet tells you what your pipeline actually did-the ground truth for execution.

---

## Real incidents this catches

**Shai-Hulud** — 800+ npm packages with a second-stage payload. Postinstall
hook bootstrapped Bun, ran TruffleHog to harvest runner secrets, then
registered a rogue GitHub runner. Caught exclusively at runtime.
[See the breakdown →](https://www.garnet.ai/resources/shai-hulud-2)

**Clinejection** — LLM agent prompt injection via a malicious GitHub Issue
triggered code execution, poisoned the Actions cache, and exposed an npm
publish token. 4,000+ developers received a backdoored package within 8 hours.

**tj-actions/changed-files** — Supply chain compromise in a widely-pinned
Action injected a memory scraper that printed runner secrets to public workflow
logs across 23,000 repos.

---

## Requirements

- **Runner**: Linux with `systemd` (recommended: `ubuntu-latest`).
- **Privileges**: the action uses `sudo` to install binaries and configure the Jibril service.
- **Checkout**: `actions/checkout@v4` is recommended. If your repo isn't checked out, Jibril may need to fetch the workflow file via the GitHub API instead.

---

## Troubleshooting

- **"API token is required"**: make sure `api_token` is set and the `GARNET_API_TOKEN` secret exists.
- **No summary output**: enable `debug: "true"` to upload Jibril logs as artifacts, then inspect `jibril.log` / `jibril.err`.
- **Restrictive permissions**: this action typically works with `permissions: contents: read`. If your workflow hardens permissions aggressively, ensure the job can read repository contents.

## Development

- Running `npm install` or `npm ci` configures a repo-local git hook path at `.githooks`.
- The pre-commit hook runs `npm run build` and stages `dist/` when staged changes can affect the bundles, so commits do not miss generated artifacts.

---

## Security

See [SECURITY.md](./SECURITY.md) for our vulnerability disclosure policy.
Report vulnerabilities to **security@garnet.ai** or via
[GitHub Security Advisories](../../security/advisories/new).

---

## License

MIT — see [LICENSE](./LICENSE)

---

[app.garnet.ai](https://app.garnet.ai) ·
[docs.garnet.ai](https://docs.garnet.ai) ·
[garnet.ai](https://garnet.ai)
