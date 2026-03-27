# Security Policy

## Reporting a Vulnerability

Report vulnerabilities via
[GitHub Security Advisories](../../security/advisories/new)
or email **security@garnet.ai**.

We acknowledge within 48 hours and provide a resolution timeline
within 5 business days. Please do not open public issues for
security vulnerabilities.

## Supported Versions

| Version | Supported |
|---------|-----------|
| v2 | ✅ Active |
| v1 | ⚠️ No new fixes |
| v0 | ❌ Unsupported |

## Scope

- garnet-org/action
- Jibril binary distributed via this action
- Garnet API and dashboard at app.garnet.ai

Out of scope: third-party dependencies, GitHub Actions infrastructure.

## Release Process

Releases are built from the `main` branch via GitHub Actions
([release.yaml](.github/workflows/release.yaml)).

- **Stable tags** (`v1`, `v2`) — advanced manually via `workflow_dispatch`
  from a reviewed commit on `main`.
- **Daily builds** (`v0`) — rebuilt nightly from HEAD for early testing.
- **CI gate** — every push and pull request runs typecheck, build, and
  dist-verification ([ci.yaml](.github/workflows/ci.yaml)).

## Binary Provenance

At runtime the action downloads two binaries:

| Binary | Source | Transport |
|--------|--------|-----------|
| `garnetctl` | [garnet-org/garnetctl-releases](https://github.com/garnet-org/garnetctl-releases/releases) | HTTPS (enforced) |
| `jibril` | [garnet-org/jibril-releases](https://github.com/garnet-org/jibril-releases/releases) | HTTPS (enforced) |

Both are fetched from GitHub Releases over HTTPS. The action refuses to
download over non-HTTPS (`enforceHttps: true`). Secrets written to disk
during setup (`/etc/default/jibril`) are installed with mode `600` and
deleted in the post step.

## Auditing

This action is open source. The entrypoint code is at:

- **Main step**: [`src/action.js`](./src/action.js)
- **Post step**: [`src/post.js`](./src/post.js)

Pre-built bundles in `dist/` are verified against source on every PR
by the CI workflow. Read the source before you install.
