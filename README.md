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

Runtime context for code review: what your CI job actually ran, and where it connected.

Garnet runs [Jibril](https://github.com/garnet-org/jibril-releases), an eBPF sensor, on the runner for the duration of the job. It records each execution chain — one path through the process tree, from the runner's root process to an observed action, today an outbound connection — and the destination reached. The record is written to the job's Step Summary; the companion GitHub App posts it to the pull request. Garnet reports; you review.

One workflow step. No code changes.

- **Action**: adds the step; Jibril records the job; the Garnet Execution Summary lands in the job's Step Summary with a public Execution Profile permalink.
- **Companion GitHub App**: owns the single Runtime Review comment per pull request. It compares each recorded job with the last 10 recorded runs of that job on the base branch; runner and GitHub traffic is shown separately and is not counted as workload change.

Public example: the Runtime Review comment on [pnpm/pnpm#17521](https://github.com/pnpm/pnpm/pull/17521).

## What Garnet records

- **Execution chains and destinations, not contents** — process names, the step they ran under when known, and outbound domains, IPs, ports and protocols. Not your source, not your secrets.
- **Observe-only** — Jibril reads kernel events through eBPF programs checked by the kernel verifier. It does not block or modify anything.
- **Scoped egress** — the action and Jibril talk to `api.garnet.ai` (or your `api_url`) and download the Jibril release from `github.com/garnet-org/jibril-releases` over HTTPS. The release bundle's checksums are verified and its signature is checked with `gh attestation verify` before Jibril runs when `github_token` and the `gh` CLI are available; otherwise the action warns and skips attestation verification.
- **Ephemeral** — Jibril runs as a systemd service and is stopped in the post step; its config and credentials are removed from the runner before the job ends.

## Permissions

| Permission | Required | Why |
| :--- | :--- | :--- |
| `contents: read` | Yes | The minimum job token. The action uses it for `gh attestation verify`, to fetch the running workflow file through the GitHub API when there is no checkout, and to read the job's status when no Execution Profile was produced. No write scope is needed; the action does not post comments. |
| `id-token: write` | Only without `api_token` | Lets the action request a GitHub OIDC token and exchange it with the Garnet control plane. Not needed when you pass `api_token`. |

The Action never needs `pull-requests: write`; the pull request comment is posted by the companion GitHub App under its own installation.

## Quickstart

### 1. Add the action to your workflow

**Already have a `GARNET_API_TOKEN`?** Keep it. Upgrading changes no permissions: the token is used as-is and no OIDC token is requested.

```yaml
on:
  push:
  pull_request:
  workflow_dispatch:

jobs:
  record:
    runs-on: ubuntu-latest

    permissions:
      contents: read

    steps:
      - name: Checkout (recommended)
        uses: actions/checkout@v6

      - uses: garnet-org/action@v2
        with:
          api_token: ${{ secrets.GARNET_API_TOKEN }}

      - name: Your existing steps
        run: |
          npm ci
          npm test
```

Create the token in [app.garnet.ai](https://app.garnet.ai) and store it as the repository secret `GARNET_API_TOKEN`.

**Without a token (GitHub OIDC):** grant `id-token: write` and omit `api_token`; the action requests a GitHub OIDC token and exchanges it with the control plane:

```yaml
    permissions:
      contents: read
      id-token: write

    steps:
      - uses: garnet-org/action@v2
```

When neither credential is available (typically fork `pull_request` and Dependabot runs) the behaviour depends on the event:

- **Pull request runs** are still recorded. Jibril runs locally, no agent is registered, no managed network policy is applied, and nothing is sent anywhere from the runner. The post step uploads the run as a workflow artifact named `garnet-run-*`, which the companion GitHub App collects with its own credentials once the workflow finishes, and the Runtime Review is published from there. This is what makes fork pull requests work: GitHub denies them both secrets and OIDC, so the artifact is the only way out of the job.
- **Every other event** skips recording, logs a warning that names the missing credential, and writes the same explanation to the Job Summary.

The workflow continues and the job is not marked failed either way.

> **Pinning:** `@v2` follows the latest `v2.x.x` release. To pin exactly, use the full commit SHA (Dependabot keeps SHA pins current):
>
> ```yaml
> # Pinned to v2.3.0
> - uses: garnet-org/action@245ad6be82de3200c205109c8ca7ac816dc692ea
> ```
>
> The SHA of the latest release is published at [garnet.ai/pins](https://garnet.ai/pins). Exact tags such as `garnet-org/action@v2.3.0` also work.

### 2. Install the companion GitHub App

[Install Garnet Runtime Review](https://github.com/apps/garnet-runtime-review/installations/select_target) on the repos you want recorded, or from Settings → GitHub in [app.garnet.ai](https://app.garnet.ai).

Since v2.3.0 the App is the only source of the pull request comment: the action no longer posts or edits comments. Without the App you still get the Job Summary and the Execution Profile in [app.garnet.ai](https://app.garnet.ai), but no comment on the PR. The App keeps one Runtime Review comment per pull request and updates it in place as each job's profile lands; It asks for four grants:

```yaml
pull-requests: write  # post and edit one Runtime Review comment per pull request
actions: read         # know when the run's jobs finish, so the comment updates in place
contents: read        # pull_request jobs run on a temporary merge commit; maps it back to your PR commit
metadata: read        # required by GitHub for every App
```

The App uses `contents: read` for one commit lookup only; it cannot push, and it cannot set a check or status.

## Not using GitHub Actions?

The same sensor runs anywhere Linux does.

- **`garnetctl` CLI + Jibril agent (any CI or host):** install [`garnetctl`](https://github.com/garnet-org/garnetctl-releases) and [`jibril`](https://github.com/garnet-org/jibril-releases) to record GitLab CI, Jenkins, Buildkite, self-hosted runners or a bare Linux host (kernel 5.10+, root for eBPF). Point it at `https://api.garnet.ai` with your API token; the Execution Profiles are the same.

  ```bash
  # Point garnetctl at the Garnet API and authenticate
  garnetctl config set-baseurl https://api.garnet.ai
  garnetctl config set-token <your-api-token>
  # Verify connectivity, then run the jibril agent on the host
  garnetctl version
  ```

- **Docker / Kubernetes:** run Jibril as a container or via the [Garnet Helm charts](https://github.com/garnet-org/helm-charts).

Installation guides for each path: [docs.garnet.ai](https://docs.garnet.ai).

## Comment anatomy

The final comment lock uses five headings: `Runtime behavior changed`, `Nothing new recorded`, `Runtime behavior recorded`, `Recording runtime behavior`, and `Runtime behavior not recorded`.

Recorded states show the changed-job count, optional coverage, one comparison line, and a best-effort capture line. Each job has one top-level fold, with workload and runner/GitHub traffic in separate trees, followed by available job-log and full-record links. The footer is a separator, a `How to read this` fold, then `Recorded by Garnet · Add it to your CI ↗` linking to garnet.ai.

Marker counts mirror the rendered added and removed workload rows. The headline outcome follows novelty: a destination is new only when none of the last 10 recorded base-branch runs reached it, and removals never change that outcome. Step labels, commit tables, `diff ↗`, and the former circular leaf marker are not part of the comment.

The same record is appended to the job's Step Summary as the **Garnet Execution Summary** ([example run](https://github.com/garnet-labs/pnpm/actions/runs/35818535654)).

## Known limitations

Read the record for what it is: what Garnet recorded, not a statement that nothing else happened.

- **Step attribution is best effort.** `(step: "…")` labels come from correlating process start times with the runner's step boundaries. Some chains land under the wrong step or under `(step: "<unknown>")`. Capture is unaffected; read those as *step unknown*, not as background activity and not as a gap in the record.
- **Merge commit, not PR head.** On `pull_request` runs GitHub checks out the synthetic merge commit. The action reports your PR head SHA to Garnet, but the comment headline and the public Execution Profile currently label the run by the commit the workflow ran on — the merge commit. Aligning them to the PR head is tracked in the control plane.
- **Matrix jobs.** Jobs that share a name across a matrix can be aggregated under one fold and undercount destinations.
- **No completeness claim.** The record states what was captured; it does not declare that every connection was captured.
- **Post-step time.** Stopping the sensor waits for Jibril to flush its Execution Profile, bounded by `stop_timeout_seconds`. On busy jobs this has been measured at 1–3 minutes; lower the bound if post-step latency matters more than a complete flush.
- **Comparison uses recorded history.** Each job uses the last 10 recorded runs of that job on the base branch; when no base record exists, the previous push is used only if it is part of the pull request.
- **Matrix legs need `job_index`.** GitHub gives every leg of a `strategy.matrix` job the same job name, so without the `job_index` input the legs are indistinguishable to Garnet. See [Matrix jobs](#matrix-jobs).

## Under the hood

- **Main step**: downloads and verifies `jibril`, authenticates with the control plane (`api_token`, else GitHub OIDC), fetches your network policy and starts Jibril as a systemd service. On a pull request with neither credential it runs the same way minus the control plane: no agent registration, no managed network policy, and no Garnet credential in `/etc/default/jibril`. If Jibril fails to start, later steps still run; the gap is disclosed in the job log and a Job Summary block with startup diagnostics, and a best-effort `start_failed` report is sent when the sensor was already registered.
- **Post step (always)**: stops Jibril so it flushes its record, appends the Garnet Execution Summary to `GITHUB_STEP_SUMMARY`, and logs the Execution Profile permalink. If the flush exceeds `stop_timeout_seconds`, the sensor is force-stopped so the job cannot hang. When no usable Execution Profile is produced, the post step reports that to the control plane so the App can resolve the pending comment. On a run that could not authenticate, it uploads the agent, profile and stop signal as a single `garnet-run-*` workflow artifact instead. With `debug: "true"` it also uploads Jibril logs as artifacts.

---

## Configuration

| Input               | Required | Default                 | Description                                    |
| ------------------- | -------- | ----------------------- | ---------------------------------------------- |
| `api_token`         | No       | —                       | Garnet API token from app.garnet.ai. When set it is used as-is and no OIDC token is requested. When empty the action tries GitHub OIDC (`id-token: write`). With neither, a pull request run is recorded locally and relayed to the GitHub App through a `garnet-run-*` workflow artifact; any other event skips recording with a warning and a Job Summary explanation. The workflow continues. |
| `github_token`      | No       | `${{ github.token }}`   | Used by `gh attestation verify` on the Jibril release and to read the job's status when no Execution Profile was produced. If unset, attestation verification is skipped with a warning. |
| `api_url`           | No       | `https://api.garnet.ai` | Garnet API base URL (HTTPS)                    |
| `jibril_version`    | No       | `v2.17.0`               | Jibril release tag (for example `v2.16.0`), `latest`, or empty to resolve from the action tag (`@v0` resolves to daily builds) |
| `job_index`         | No       | —                       | **Strongly recommended on matrix jobs**: pass `${{ strategy.job-index }}`. Without it every leg of a matrix shares one identity and the Runtime Review reports a single leg. See [Matrix jobs](#matrix-jobs). |
| `stop_timeout_seconds` | No    | `1800`                  | Seconds Jibril gets at shutdown to finish writing its Execution Profile. The post step waits this long plus a small grace, then force-stops the sensor. `0` or negative disables the bound. |
| `debug`             | No       | `false`                 | Verbose logging; uploads Jibril logs as artifacts |
| `preview`           | No       | `false`                 | Render the full-fidelity Step Summary record. Unstable shape; may change without a major version bump |

> **Fork PRs:** `pull_request` runs from forks get no repository secrets and no `id-token: write`. The action records the job locally anyway and uploads it as a `garnet-run-*` workflow artifact; the companion GitHub App collects it after the run and publishes the Runtime Review. Nothing leaves the runner from the job itself, and no credential is written to disk. The Review is published only if the App is installed on the repository. Managed network policies do not apply to these runs — policy enforcement needs the control plane.
>
> **Dependabot PRs:** Dependabot-triggered runs read `secrets.*` from the Dependabot secrets store, so an Actions-only `GARNET_API_TOKEN` resolves empty and the run falls back to the same artifact relay. To record them through the control plane directly, add the same token under the same name in **Settings → Secrets and variables → Dependabot**.

### Matrix jobs

GitHub gives every leg of a `strategy.matrix` job the same job name, and the one value that tells them apart — `strategy.job-index` — is available only as a workflow expression. Pass it to the action so each leg is recorded as its own:

```yaml
jobs:
    test:
        strategy:
            matrix:
                node: [20, 22, 24]
        runs-on: ubuntu-latest
        steps:
            - uses: garnet-org/garnet-action@v0
              with:
                  job_index: ${{ strategy.job-index }}
```

Without it, all legs record under one identity: the Runtime Review shows a single leg instead of every one, and comparison against the previous commit cannot line legs up. Nothing is lost on the way out — on the artifact relay each leg still uploads under a distinct `garnet-run-*` name — but the legs arrive unlabelled and cannot be told apart. Leave the input unset on non-matrix jobs.

---

## Outputs

| Output           | Description                                                          |
| ---------------- | -------------------------------------------------------------------- |
| `profile_result` | Reserved for compatibility; not set by this action |
| `report_url`     | Run URL set in the main step, before capture. Not a profile permalink and not proof of upload; use the `?profile=` link in the comment or Execution Summary. |
| `agent_id`       | Sensor identifier assigned at registration. Registration alone does not confirm capture. |

---

## Why

Code review sees the diff. CI runs it: postinstall scripts execute, agent-written steps spawn processes, build steps open connections. None of that is in the diff. Runtime Review puts the record of what ran, and where it connected, next to the review.

Worked example: [What Garnet saw during Shai-Hulud](https://www.garnet.ai/resources/garnet-saw-shai-hulud) — a postinstall hook bootstrapping Bun, running TruffleHog against runner secrets and registering a rogue runner, as it appears in an execution record.

---

## Setup & support

### Requirements

- Linux x86_64 runner with systemd (`ubuntu-latest` or a label from the table below)
- passwordless `sudo` (to install Jibril and run it as a systemd service)
- `api_token` from a repository secret, **or** `id-token: write` for GitHub OIDC

### Supported runners

| Runner | Labels | Notes |
| ------ | ------ | ----- |
| GitHub-hosted Linux | `ubuntu-latest`, `ubuntu-24.04`, `ubuntu-22.04` | x86_64 only |
| [Blacksmith](https://www.blacksmith.sh) Linux | for example `blacksmith-8vcpu-ubuntu-2404` | Used on [pnpm/pnpm](https://github.com/pnpm/pnpm) CI |
| [Depot](https://depot.dev/docs/github-actions/runner-types) Linux | for example `depot-ubuntu-24.04` | x86_64 labels only; `-arm` labels are skipped |

On Windows, macOS and arm64 the action logs a warning and skips recording; the workflow continues.

### Troubleshooting

| Symptom                                   | Fix                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| "Garnet skipped this Runtime Review because no authentication mechanism was available" | `api_token` was empty and no OIDC token could be requested, on an event that cannot be relayed (anything other than a pull request). Pass `api_token` from a secret or grant `id-token: write`; the job continues either way. |

| No pull request comment                   | The comment is posted by the companion GitHub App — [install it](https://github.com/apps/garnet-runtime-review/installations/select_target) on the repository. The Job Summary and the profile in app.garnet.ai do not depend on the App. |
| `(step: "<unknown>")` labels              | Step attribution is best effort (see Known limitations). The chain was recorded; only its step is unknown. |
| Post step is slow                         | The sensor is flushing its record. Lower `stop_timeout_seconds` to bound it. |
| No Execution Summary                      | Set `debug: "true"` to upload Jibril logs as artifacts, then inspect `jibril.log` and `jibril.err`. |

### Security & license

See [SECURITY.md](./SECURITY.md) to report vulnerabilities — or email [security@garnet.ai](mailto:security@garnet.ai). MIT — see [LICENSE](./LICENSE).

---

[app.garnet.ai](https://app.garnet.ai) · [docs.garnet.ai](https://docs.garnet.ai) · [garnet.ai](https://garnet.ai)
