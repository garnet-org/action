<div align="center">
  <a href="https://garnet.ai">
    <img src="brand/garnet-logo.png" alt="Garnet" width="160" />
  </a>
  <p><strong>Runtime visibility for GitHub Workflows</strong></p>
  <p>
    <a href="https://app.garnet.ai">Get an API token</a>
    <a href="https://docs.garnet.ai">Docs</a> ·
  </p>
  <p>
    <a href="../../releases">
      <img alt="Release" src="https://img.shields.io/github/v/release/garnet-org/action?display_name=tag&sort=semver" />
    </a>
    <a href="./LICENSE">
      <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg" />
    </a>
  </p>
</div>

---

Runtime profiling and behavioral assertions for your GitHub workflows.

Garnet is powered by [Jibril](https://jibril.garnet.ai), an eBPF sensor that attaches to your CI runner and captures every process spawn and outbound connection — with full lineage. Results surface in-line showing pass / fail per run with context, similar to what you expect from tests.

One YAML step. No code changes.

```yaml
- uses: garnet-org/action@v2
  with:
    api_token: ${{ secrets.GARNET_API_TOKEN }}
```

Get your API token at [app.garnet.ai](https://app.garnet.ai)

---

## What you get

**A behavioral profile of every run.**
Jibril captures every process spawn and outbound connection during your workflow — with full lineage tracing which parent spawned which child, all the way down to the exact binary that opened the connection.

**Runtime assertions in your PR.**
Assertions are like unit tests for runtime behavior. Results appear as a PR comment and step summary: a table per job with pass / fail assertions and an egress table with lineage inline. A permalink links to the full run report.

**Lineage-first evidence.**
When something unexpected runs, you don't get a domain name — you get the full chain:

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
| `debug` | No | `false` | Enable debug mode and upload logs as artifacts |

---

## How it works

#### Assertions

Assertions are runtime invariants — like unit tests, but for execution behavior. The current assertion is `known_bad_egress`: it fails if any outbound connection matches a domain from Garnet's managed threat feed. Future assertion families will cover hidden binary execution, sensitive file access, and anomalous process spawns.

#### Why runtime visibility matters

Your team reviews the code. Your CI runs it. Between `git push` and production, dependencies execute postinstall scripts, AI-generated functions spawn processes, and build steps make outbound connections — none of which appear in a static scan. Garnet tells you what your pipeline actually did — the ground truth for execution.

#### Real incidents

- **Shai-Hulud** — 800+ npm packages with a second-stage payload. Postinstall hook bootstrapped Bun, ran TruffleHog to harvest runner secrets, then registered a rogue GitHub runner. [See the breakdown →](https://www.garnet.ai/resources/shai-hulud-2)

- **Clinejection** — LLM agent prompt injection via a malicious GitHub Issue triggered code execution, poisoned the Actions cache, and exposed an npm publish token. 4,000+ developers received a backdoored package within 8 hours.

- **tj-actions/changed-files** — Supply chain compromise in a widely-pinned Action injected a memory scraper that printed runner secrets to public workflow logs across 23,000 repos.

---

## Setup & support

#### Requirements

Requires `runs-on: ubuntu-latest` (Linux with systemd), `sudo` access to install binaries, and `GARNET_API_TOKEN` set as a repository secret.

#### Troubleshooting

**"API token is required"** — confirm `GARNET_API_TOKEN` is set in your repository secrets and passed as `api_token`.

**No PR comment appearing** — the action posts comments only on `pull_request` events. Confirm your workflow triggers include `pull_request`.

**No summary output** — enable `debug: "true"` to upload Jibril logs as artifacts, then inspect `jibril.log` and `jibril.err`.

**Restrictive permissions** — this action works with `permissions: contents: read`. If your workflow hardens permissions aggressively, ensure the job can read repository contents.

#### Security & license

See [SECURITY.md](./SECURITY.md) to report vulnerabilities — or email **security@garnet.ai**. MIT — see [LICENSE](./LICENSE)

---

[app.garnet.ai](https://app.garnet.ai) · [docs.garnet.ai](https://docs.garnet.ai) · [garnet.ai](https://garnet.ai)
