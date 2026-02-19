# Garnet Runtime Security

> Protect your workflows with real-time runtime security monitoring

The **Garnet Runtime Security** action integrates the [Jibril security scanner](https://jibril.garnet.ai) with the [Garnet Dashboard](https://dashboard.garnet.ai) to provide runtime threat detection in your GitHub Actions workflows. Detect suspicious activity, network connections, and potential security threats as your workflow runs.

## Features

- **Seamless integration** — Add to any workflow with a single step
- **Runtime detection** — Monitors your workflow as it executes
- **Extensive monitoring** — File access, execution, and network analysis
- **Network policy enforcement** — Block suspicious connections automatically
- **Job summary** — Security profile markdown appended to the workflow job summary

## Getting Started

### 1. Create an API token

1. Register or log in at [Garnet](https://app.garnet.ai/)
2. Go to your account settings
3. Create a new API token
4. Save it for the next step

### 2. Add the token as a repository secret

1. In your repository: **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `GARNET_API_TOKEN`
4. Value: your Garnet API token
5. Click **Add secret**

## Usage

Add the action to your workflow (e.g. `.github/workflows/security.yaml`):

```yaml
name: Security Monitoring

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Garnet Runtime Security
        uses: garnet-org/action@v0
        with:
          api_token: ${{ secrets.GARNET_API_TOKEN }}
```

Pin to a release tag (e.g. `@v1.0.0`) or use `@main` for the latest.

## Configuration

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `api_token` | Garnet API token | Yes | — |
| `api_url` | Garnet API base URL | No | `https://api.garnet.ai` |
| `garnetctl_version` | Garnet CLI version | No | `latest` |
| `jibril_version` | Jibril version | No | `0.0` |
| `debug` | Enable debug output | No | `false` |

## Examples

The [`examples/`](examples/) directory contains reference workflows. Copy them into your repo’s `.github/workflows/` as needed.

- **workflow-example.yaml** — Minimal workflow for push/PR to `main` and manual trigger. Copy to `.github/workflows/` (e.g. as `garnet-security.yaml`), add the `GARNET_API_TOKEN` secret, and optionally override `api_url`, `garnetctl_version`, `jibril_version`, or `debug`.

The action runs a **main** step (install and start Jibril) and a **post** step that runs at the end of the job (even if the main step fails). The post step stops Jibril and appends the security profile markdown to the job summary.

## License

MIT

---

<div align="center">
  <a href="https://garnet.ai">
    <img src="https://garnet.ai/wp-content/uploads/2023/06/logo_dark.svg" alt="Garnet" width="200" height="40">
  </a>
  <p><sub>Made with ❤️ by the Garnet team</sub></p>
</div>
