<div align="center">
  <a href="https://garnet.ai">
    <img src="brand/garnet-logo.png" alt="Garnet" width="260" />
  </a>

  <p><strong>Runtime visibility for GitHub Workflows</strong></p>

  <p>
    <a href="https://app.garnet.ai">Get an API token</a> ·
    <a href="https://docs.garnet.ai">Docs</a>
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

Runtime profiling and behavioral assertions for CI/CD and agentic workflows in GitHub Actions.

Garnet is powered by [Jibril](https://jibril.garnet.ai), an eBPF sensor that attaches to your CI runner and captures every process spawn and outbound connection — with full lineage. Results surface in line, showing pass/fail for each run with rich context.

One YAML step. No code changes and minimal overhead.

Get your API token at [app.garnet.ai](https://app.garnet.ai).

## What you get

- **A behavioral profile of every run**: Kernel-level capture of every network call, process spawn, and file access — with full lineage from parent to child, down to the exact binary that made the connection.
- **Runtime assertions in your PR**: Assertions are like unit tests for runtime behavior. Results appear as a PR comment and step summary: a table per job with pass/fail assertions and an egress table with lineage inline, plus a permalink to the full run report and configurable alerts on failures.
- **Lineage-based evidence**: When something unexpected runs, you don't just see a domain name — you see the full chain.

<p align="center">
  <img
    src="https://github.com/user-attachments/assets/d7e3c6ac-b968-4e2b-98cd-47df1cae6620"
    width="640"
    alt="Garnet lineage view"
  />
</p>

## What this action does NOT do

- **Read your source code** — Jibril monitors process and network behavior at the kernel level. It does not read, scan, or transmit repository contents.
- **Access your secrets** — The action uses only the `GARNET_API_TOKEN` you provide and the default `GITHUB_TOKEN` for PR comments. It does not read or forward any other repository secrets.
- **Make unexpected network calls** — `garnetctl` and Jibril communicate only with `api.garnet.ai` (configurable via `api_url`). Binaries are downloaded from `github.com/garnet-org/*-releases` over HTTPS. No other outbound connections are made by the action itself.
- **Persist after the run** — Jibril runs as a systemd service that is stopped in the post step. Secrets are removed from disk and config files are cleaned up. On ephemeral GitHub-hosted runners, nothing survives the job.

## Permissions

| Permission              | Required     | Why                                                |
|------------------------|--------------|----------------------------------------------------|
| `contents: read`       | Yes          | Access workflow context and repository metadata   |
| `pull-requests: write` | Recommended  | Post the runtime profile as a PR comment          |

This action does not require `contents: write`, `actions: write`, or access to any repository secrets beyond the ones you explicitly pass.

## Quickstart

### 1. Create a token

Create an API token in the Garnet app at <https://app.garnet.ai>, then add it as a repo secret named `GARNET_API_TOKEN`.

### 2. Add the action to your workflow

```yaml
on:
  push:
  pull_request:
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: Checkout (recommended)
        uses: actions/checkout@v6

      - uses: garnet-org/action@v2
        with:
          api_token: ${{ secrets.GARNET_API_TOKEN }}

      - name: Your existing steps
        run: npm test
```

> **Tip:** For maximum supply-chain safety, pin to a full commit SHA instead of a tag:
> ```yaml
> - uses: garnet-org/action@<commit-sha> # v2
> ```

## What you'll see

- **GitHub job summary**: A Markdown "security profile" appended at the end of the job — even if the job fails (see an example [here](https://github.com/garnet-org/action/actions/runs/23175135499)).
- **Pull request comment**: On pull request workflows, Garnet posts one comment per push, merging jobs and workflows from the same push into a single comment.

  <img
    src="https://github.com/user-attachments/assets/13e0153b-fcfd-4794-b349-4a86e939e58a"
    width="720"
    alt="Garnet PR comment example"
  />

- **Garnet UI**: Linked from in-line results through a permalink for in-depth investigation and additional management features, such as Slack alerts on failures.
- **Run profile page**: An artifact showing the behavioral profile for a run, shareable through the UI (see an example from the recent [telnyx TeamPCP incident](https://app.garnet.ai/public/runs/23662517211)).

## Under the hood

- **Main step**: Downloads `garnetctl` and `jibril`, creates a Garnet agent for the run, fetches your merged network policy, and starts Jibril as a `systemd` service on the runner. If Jibril crashes during startup, the action logs diagnostics and continues so later workflow steps still run.
- **Post step (always)**: Stops Jibril so it flushes events, appends the generated profile to `GITHUB_STEP_SUMMARY`, and creates or updates the pull request comment for the current push when the workflow runs for a PR. When `debug=true`, it also uploads Jibril logs as build artifacts.

## Pull request comments

For PR workflows, the action reads Jibril's JSON profile and rebuilds the Markdown into a single comment per push. Multiple jobs and workflows from the same push are merged into that comment so the PR stays readable while still preserving history across pushes.

To let the action write PR comments, grant the workflow token write access to pull requests:

```yaml
permissions:
  contents: read
  pull-requests: write
```

---

## Configuration

| Input               | Required | Default                  | Description                                          |
|---------------------|----------|--------------------------|------------------------------------------------------|
| `api_token`         | Yes      | —                        | Your Garnet API token from app.garnet.ai            |
| `github_token`      | No       | `${{ github.token }}`    | GitHub token used for pull request comments         |
| `api_url`           | No       | `https://api.garnet.ai`  | Garnet API base URL                                 |
| `garnetctl_version` | No       | `latest`                 | Garnet CLI version (`1.2.3` or `latest`)            |
| `jibril_version`    | No       | `""` (auto)              | Jibril version (`v2.10.8` or `latest`)              |
| `debug`             | No       | `false`                  | Enable debug mode and upload logs as artifacts      |

---

## Concepts

#### Assertions

Assertions are runtime invariants — like unit tests, but for execution behavior. The current assertion is `known_bad_egress`, which fails if any outbound connection matches a domain from Garnet's managed threat feed. Future assertion families will cover hidden binary execution, sensitive file access, and anomalous process spawns.

#### Why runtime visibility matters

Your team reviews the code; your CI runs it. Between `git push` and production, dependencies execute postinstall scripts, AI-generated functions spawn processes, and build steps make outbound connections — none of which appear in a static scan. Garnet tells you what your pipeline actually did — the ground truth for execution.

#### Real incidents

- **Shai-Hulud** — 800+ npm packages with a second-stage payload. A postinstall hook bootstrapped Bun, ran TruffleHog to harvest runner secrets, then registered a rogue GitHub runner. [See the breakdown →](https://www.garnet.ai/resources/garnet-saw-shai-hulud)
- **Clinejection** — LLM agent prompt injection via a malicious GitHub Issue triggered code execution, poisoned the Actions cache, and exposed an npm publish token. Over 4,000 developers received a backdoored package within eight hours.
- **tj-actions/changed-files** — Supply-chain compromise in a widely pinned Action injected a memory scraper that printed runner secrets to public workflow logs across 23,000 repositories.

---

## Setup & support

### Requirements

- `runs-on: ubuntu-latest` — Linux runner with systemd
- `sudo` access to install binaries and configure the Jibril service
- `GARNET_API_TOKEN` set as a repository secret

### Troubleshooting

| Symptom                                    | Fix                                                                                                         |
|--------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| "API token is required"                    | Confirm `GARNET_API_TOKEN` is set in repository secrets and passed as `api_token`.                         |
| No PR comment appearing                    | The action posts comments only on `pull_request` events — confirm your workflow includes that trigger.     |
| PR comment says "Resource not accessible" | Add `pull-requests: write` to the workflow `permissions` block.                                            |
| No summary output                          | Enable `debug: "true"` to upload Jibril logs as artifacts, then inspect `jibril.log` and `jibril.err`.    |
| Restrictive permissions                    | This action works with `permissions: contents: read` — ensure the job can read repository contents.        |

### Security & license

See [SECURITY.md](./SECURITY.md) to report vulnerabilities — or email **security@garnet.ai**. MIT — see [LICENSE](./LICENSE).

---

[app.garnet.ai](https://app.garnet.ai) · [docs.garnet.ai](https://docs.garnet.ai) · [garnet.ai](https://garnet.ai)
