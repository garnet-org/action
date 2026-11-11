# Garnet in the GitHub Copilot coding agent

The Action runs unmodified in the Copilot coding agent. Copilot executes the `copilot-setup-steps` job from
`.github/workflows/copilot-setup-steps.yml` inside its own agent job before the agent starts, so the Garnet
step starts Jibril first. Its post step runs after the agent's "Processing Request" step, so the agent's
commands fall inside the recording window.

```yaml
jobs:
  copilot-setup-steps:          # Copilot only runs a job with exactly this name
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: garnet-org/action@<pinned-sha> # vX.Y.Z
        with:
          api_token: ${{ secrets.GARNET_API_TOKEN }}
```

The workflow must be on the default branch for Copilot to pick it up. The `push` / `workflow_dispatch`
triggers that GitHub's template adds run the same job as a normal workflow. Use them to check the setup
without starting an agent session.

## What was checked (2026-11-11)

| Check | Run | Result |
|---|---|---|
| Copilot agent job runs the Garnet step as a user setup step | [garnet-org/action 30055929475](https://github.com/garnet-org/action/actions/runs/30055929475) (Copilot cloud agent, action `ccd6b73`) | Setup step and post step both succeeded. The post step ran after the agent's request processing. No Execution Profile could be retrieved for this run with the available project tokens, and its logs have expired. |
| Same job as a normal workflow, current release | [jadoonf/garnet-agentic-harness-poc 43078162222](https://github.com/jadoonf/garnet-agentic-harness-poc/actions/runs/43078162222) (action `673a06d` v2.5.2, Jibril v2.17.0) | Jibril ready in 10 s (86 programs, 82 attached, no eBPF errors). Agent registered. Profile `01a1cbdf-1588-7c62-a00e-f1b5888349f8` was returned by the Garnet MCP `profiles` tool for that `runID`, with workload egress to `registry.npmjs.org` (node) and `api.garnet.ai` (curl). |
| Garnet MCP reachable from the runner | same run | `initialize` returned `garnet-mcp v1.42.3`; `tools/list` returned `profiles`, `create_device_authorization` and `device_authorization_status`. |

## MCP for the agent itself

Setup steps run with normal runner networking. The agent session itself runs behind Copilot's firewall.
Before the agent can call `https://api.garnet.ai/api/v2/mcp`, a repository admin has to:

1. allow `api.garnet.ai` in the repository's Copilot coding agent firewall allowlist;
2. add the server under Settings → Copilot → Coding agent → MCP configuration, as a remote `http` server
   with the project token supplied through a `COPILOT_MCP_`-prefixed secret in the `copilot` environment.

Calling the MCP from inside a live agent session has not been tested yet; this needs a Copilot seat on the repository.
