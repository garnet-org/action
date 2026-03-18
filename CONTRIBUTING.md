# Contributing to Garnet Runtime Security Action

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/garnet-org/action.git
cd action

# Install dependencies (also sets up git hooks)
npm ci --include=dev

# Typecheck
npm run typecheck

# Build dist/ bundles
npm run build
```

## How It Works

- **`src/main.js`** — Entry point: saves action inputs as state, calls `action.js`.
- **`src/action.js`** — Downloads garnetctl + jibril, creates an agent, fetches network policy, starts Jibril as a systemd service.
- **`src/post.js`** — Post step: stops Jibril, writes the security profile to the job summary, publishes PR comments.
- **`dist/`** — Pre-built NCC bundles shipped with the action. Consumers never build from source.

## Making Changes

1. Edit files in `src/`.
2. Run `npm run validate` (typecheck + build).
3. Commit both `src/` and `dist/` changes — the pre-commit hook handles the build automatically when you have staged `src/` changes.
4. Open a pull request against `main`.

## Pull Request Guidelines

- Keep PRs focused — one logical change per PR.
- Include a clear description of what changed and why.
- Ensure `npm run validate` passes.
- The CI workflow verifies that `dist/` is in sync with `src/`.

## Reporting Issues

Open an issue at https://github.com/garnet-org/action/issues. For security
vulnerabilities, see [SECURITY.md](./SECURITY.md).
