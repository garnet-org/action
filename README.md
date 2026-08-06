# Garnet Runtime Review

<div align="center">
  <a href="https://garnet.ai">
    <img src="brand/garnet-logo.png" alt="Garnet" width="260" />
  </a>

  <p><strong>Runtime Review for your PRs</strong></p>

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

Runtime review for CI/CD and agentic workflows in GitHub Actions.

Garnet is powered by [Jibril](https://jibril.garnet.ai), an eBPF sensor that attaches to your CI runner and records every process spawn and outbound connection — the full execution tree. The Action stage posts a PR comment and the Garnet Execution Summary in the GitHub job UI for the jobs it can see. The companion GitHub App owns the authoritative PR comment when installed.

One YAML step. No code changes and minimal overhead.

Get your API token at [app.garnet.ai](https://app.garnet.ai). Start with the Action, then install the companion GitHub App for the full PR experience.

## What you get

- **Action stage**: Add the workflow step and Jibril records runtime from that job. The action self-posts a PR comment plus the Garnet Execution Summary. Because the Action only knows its own jobs, the headline says how many jobs it recorded. Each job links to its Execution Profile on app.garnet.ai: `https://app.garnet.ai/public/runs/<run-id>?profile=<profile-id>` when the profile's envelope ID is recorded, or the run page `https://app.garnet.ai/dashboard/runs/<run-id>` otherwise — the app resolves either server-side and shows logged-out visitors the public report.
- **Companion GitHub App stage**: Install the companion GitHub App for the full PR experience. The App owns the authoritative PR comment across all jobs in the run, plus Slack alerts and cross-run management.
- **Execution-chain evidence**: When something unexpected runs, you don't just see a domain name — you see the execution chain behind the connection, from the runner's root to the action.

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
- **Make unexpected network calls** — The action and Jibril communicate only with `api.garnet.ai` (configurable via `api_url`). Jibril binaries are downloaded from `github.com/garnet-org/jibril-releases` over HTTPS. No other outbound connections are made by the action itself.
- **Persist after the run** — Jibril runs as a systemd service that is stopped in the post step. Secrets are removed from disk and config files are cleaned up. On ephemeral GitHub-hosted runners, nothing survives the job.

## Permissions

| Mode | Permission | Why |
| ---- | ---------- | --- |
| Standalone Action | `contents: read` | Access workflow context and repository metadata |
| Standalone Action | `pull-requests: write` | Post and update the PR comment from the workflow |
| App-installed | `contents: read` | The Action still reads the workflow context and the Jibril profile |
| App-installed | `pull-requests: write` | Not used by the Action when the companion GitHub App owns the comment |

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

> **Tip:** Major tags such as `@v2` track the latest `v2.x.x` release automatically. Use `@main` only if you want the latest unreleased code, or pin to a full commit SHA for maximum supply-chain safety:
>
> ```yaml
> - uses: garnet-org/action@<commit-sha>
> ```

### 3. Install the companion GitHub App

Install the companion GitHub App for the full Runtime Review experience in your PRs. <!-- TODO(farrukh): confirm GitHub App install URL + exact permissions/feature list -->

### Versioning

- `garnet-org/action@v2` tracks the latest `v2.x.x` release.
- `garnet-org/action@main` tracks the latest unreleased code on the default branch.
- Exact tags such as `garnet-org/action@v2.3.0` remain available when you want a fully pinned released version.

## Action vs. GitHub App

**Standalone mode** (Action only): the action records runtime, posts the PR comment and the Garnet Execution Summary, and only knows the jobs it observed in that run.

**App-installed mode**: the companion GitHub App owns the authoritative PR comment. The App marks its comment with an environment-scoped marker (`<!-- garnet-control-plane-pr-comment:v1 -->`); when the action sees that marker it stands down on both create and update — it stops posting or updating its own comment, so the PR converges to a single comment with no duplicates. The action keeps posting the Garnet Execution Summary for its own job in both modes — the Step Summary is the job's own projection and the App does not replace it.

## Comment anatomy

- **PR comment**: A headline (`Execution Profiles recorded for N job(s)…`), a count-shaped metadata line, then one `<details>` fold per job with the job's execution tree and outbound destinations.
- **Garnet Execution Summary**: A distinct projection of the same recorded evidence, appended to the job's Step Summary in the GitHub job UI (see this [example GitHub Actions run](https://github.com/garnet-org/action/actions/runs/23175135499)). It renders per job, keeps full destination detail, and appears in both standalone and App-installed modes.
- **Pull request comment lifecycle**: On pull request workflows, Garnet posts one comment per push, merging jobs and workflows from the same push into a single comment. When the GitHub App is installed, the action defers so the App keeps ownership of that comment.

  <img
    src="https://github.com/user-attachments/assets/13e0153b-fcfd-4794-b349-4a86e939e58a"
    width="720"
    alt="Garnet PR comment example"
  />

- **Garnet UI**: Each job fold links to its Execution Profile for in-depth investigation and additional management features, such as Slack alerts.
- **Execution Profile page**: The recorded profile for a job, shareable through the UI — for example [this recorded run](https://app.garnet.ai/public/runs/30027944022?profile=019f8ff1-3110-7cb4-b304-7e5ec8ce7911). The canonical link shape is `https://app.garnet.ai/public/runs/<run-id>?profile=<profile-id>`; a bare run URL without the `?profile=` selector is not a stable permalink.

## Under the hood

- **Main step**: Downloads `jibril`, registers the sensor with the control-plane API, fetches your merged network policy from the API, and starts Jibril as a `systemd` service on the runner. If Jibril crashes during startup, the action logs diagnostics and continues so later workflow steps still run.
- **Post step (always)**: Stops Jibril so it flushes events, appends the Garnet Execution Summary to `GITHUB_STEP_SUMMARY`, and creates or updates the pull request comment for the current push when the workflow runs for a PR. When `debug=true`, it also uploads Jibril logs as build artifacts.

## Pull request comments

For PR workflows in standalone Action mode, the action reads Jibril's JSON profile and rebuilds the Markdown into a single comment per push. Multiple jobs and workflows from the same push are merged into that comment so the PR stays readable while still preserving history across pushes. When the companion GitHub App is installed, the action stands down and the App owns that comment (see [Action vs. GitHub App](#action-vs-github-app)).

In standalone mode, grant the workflow token write access to pull requests:

```yaml
permissions:
  contents: read
  pull-requests: write
```

---

## Configuration

| Input               | Required | Default                 | Description                                    |
| ------------------- | -------- | ----------------------- | ---------------------------------------------- |
| `api_token`         | Yes      | —                       | Your Garnet API token from app.garnet.ai       |
| `github_token`      | No       | `${{ github.token }}`   | GitHub token used for pull request comments    |
| `api_url`           | No       | `https://api.garnet.ai` | Garnet API base URL                            |
| `jibril_version`    | No       | `""` (auto)             | Jibril version (`v2.16.0` or `latest`); empty resolves from the action ref (`@v2` pins `v2.10.8`) |
| `debug`             | No       | `false`                 | Enable debug mode and upload logs as artifacts |

---

## Outputs

| Output           | Description                                                          |
| ---------------- | -------------------------------------------------------------------- |
| `profile_result` | Reserved for the companion GitHub App and control plane; the action does not set it |
| `report_url`     | The run's page on app.garnet.ai (`https://app.garnet.ai/dashboard/runs/<run-id>`). Emitted by the main step, before the sensor has recorded anything, so later steps in the same job can read it — it is a run link, not a per-profile permalink. The app resolves it server-side and shows logged-out visitors the public run report. |
| `agent_id`       | Declared for forward compatibility; the action does not currently set it |

---

## Concepts

### Observation scope

The current observation scope is `known_bad_egress`, which marks outbound connections to domains on Garnet's managed known-bad domain list. Future scopes will cover hidden binary execution, sensitive file access, and anomalous process spawns.

### Why Runtime Review matters

Your team reviews the code; your CI runs it. Between `git push` and production, dependencies execute postinstall scripts, AI-generated functions spawn processes, and build steps make outbound connections — none of which appear in a static scan. Garnet tells you what your pipeline actually did — the ground truth for runtime evidence.

### Real incidents

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

| Symptom                                   | Fix                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| "API token is required"                   | Confirm `GARNET_API_TOKEN` is set in repository secrets and passed as `api_token`.                     |
| No PR comment appearing                   | The action posts comments only on `pull_request` events — confirm your workflow includes that trigger. |
| PR comment says "Resource not accessible" | Add `pull-requests: write` to the workflow `permissions` block.                                        |
| No summary output                         | Enable `debug: "true"` to upload Jibril logs as artifacts, then inspect `jibril.log` and `jibril.err`. |
| Comment posted by `garnet-runtime-review[bot]` instead of `github-actions[bot]` | The companion GitHub App is installed and owns the PR comment; the action stands down. This is expected — the App comment covers all jobs in the run. |
| Restrictive permissions                   | This action works with `permissions: contents: read` — ensure the job can read repository contents.    |

### Security & license

See [SECURITY.md](./SECURITY.md) to report vulnerabilities — or email [security@garnet.ai](mailto:security@garnet.ai). MIT — see [LICENSE](./LICENSE).

---

[app.garnet.ai](https://app.garnet.ai) · [docs.garnet.ai](https://docs.garnet.ai) · [garnet.ai](https://garnet.ai)
