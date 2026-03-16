# Garnet Runtime Security

<div align="center">
  <a href="https://garnet.ai">
    <img src="brand/garnet-logo.png" alt="Garnet" width="160" />
  </a>

  <p><strong>Runtime threat detection for your GitHub Actions jobs.</strong></p>

  <p>
    <a href="https://dashboard.garnet.ai">Dashboard</a> ·
    <a href="https://jibril.garnet.ai">Jibril</a> ·
    <a href="https://app.garnet.ai">Get an API token</a>
  </p>

  <p>
    <a href="../../releases">
      <img alt="Release" src="https://img.shields.io/github/v/release/garnet-org/action?display_name=tag&sort=semver" />
    </a>
    <a href="../../issues">
      <img alt="Issues" src="https://img.shields.io/github/issues/garnet-org/action" />
    </a>
    <a href="./LICENSE">
      <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg" />
    </a>
  </p>
</div>

Protect your CI/CD from inside the runner. This action installs and runs **Jibril** during your job to observe process, filesystem, and network activity, enforce **Garnet network policies**, and publish a **security profile** to the job summary and pull requests.

## Why this action

- **Catch suspicious behavior at runtime**: alerts when workflows behave like malware (unexpected execs, file access, outbound connections).
- **Enforce network policy**: block or flag connections that violate your org’s policy.
- **Ship with low friction**: one step in your workflow; results land in GitHub (job summary) and in Garnet (dashboard).

## Quickstart

### 1) Create a token

Create an API token in the Garnet app at `https://app.garnet.ai`, then add it as a repo secret named `GARNET_API_TOKEN`.

### 2) Add the action to your workflow

```yaml
name: Garnet Runtime Security
on:
  push:
  pull_request:
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Checkout (recommended)
        uses: actions/checkout@v6

      - name: Garnet Runtime Security
        uses: garnet-org/action@v0
        with:
          api_token: ${{ secrets.GARNET_API_TOKEN }}
```

## What you’ll see

- **GitHub job summary**: a Markdown “security profile” appended at the end of the job (runs even if the job fails).
- **Pull request comment**: on pull request workflows, a sticky Garnet comment is created or updated with the latest run and merged job profiles.
- **Garnet dashboard**: runtime events and policy evaluation for the workflow run.

## How it works

- **Main step**: downloads `garnetctl` + `jibril`, creates a Garnet “agent” for the run, fetches your merged network policy, and starts Jibril as a `systemd` service on the runner.
- **Post step (always)**: stops Jibril so it flushes events, appends the generated profile to `GITHUB_STEP_SUMMARY`, and updates a sticky pull request comment when the workflow runs for a PR. When `debug=true`, it also uploads Jibril logs as build artifacts.

## Pull request comments

For PR workflows, the action reads Jibril's JSON profile and rebuilds the markdown into a single sticky comment for the latest workflow run. Multiple jobs from the same run are merged into that one comment so the PR stays readable.

To let the action write PR comments, grant the workflow token write access to pull requests or issue comments. For example:

```yaml
permissions:
  contents: read
  pull-requests: write

steps:
  - uses: garnet-org/action@v0
    with:
      api_token: ${{ secrets.GARNET_API_TOKEN }}
```

## Inputs

| Input | Description | Required | Default |
|------|-------------|----------|---------|
| `api_token` | Garnet API token | Yes | - |
| `github_token` | GitHub token used to publish pull request comments | No | `${{ github.token }}` |
| `api_url` | Garnet API base URL | No | `https://api.garnet.ai` |
| `garnetctl_version` | `garnetctl` version (`1.2.3` or `latest`) | No | `latest` |
| `jibril_version` | Jibril version (`v2.10.8`, `v0.0`, or `latest`) | No | `v0.0` (action@`v0`) / `v2.10.4` (action@`v1`) / `v2.10.8` (action@`v2`) |
| `profiler_4fun` | Enable profiler “4 fun” mode | No | `false` |
| `debug` | Enable debug output + upload Jibril logs as artifacts | No | `false` |

## Requirements & compatibility

- **Runner**: Linux with `systemd` (recommended: `ubuntu-latest`).
- **Privileges**: the action uses `sudo` to install binaries and configure the Jibril service.
- **Checkout**: `actions/checkout@v4` is recommended. If your repo isn’t checked out, Jibril may need to fetch the workflow file via the GitHub API instead.

## Troubleshooting

- **“API token is required”**: make sure `api_token` is set and the `GARNET_API_TOKEN` secret exists.
- **No summary output**: enable `debug: "true"` to upload Jibril logs as artifacts, then inspect `jibril.log` / `jibril.err`.
- **Restrictive permissions**: this action typically works with `permissions: contents: read`. If your workflow hardens permissions aggressively, ensure the job can read repository contents.

## License

MIT

---

<div align="center">
  <p><sub>Built by the Garnet team · <a href="https://garnet.ai">garnet.ai</a></sub></p>
</div>
