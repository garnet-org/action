# GarnetAI GitHub Action

This GitHub Action runs the Jibril security scanner for runtime threat detection in your GitHub Actions workflow.

## Setup

### 1. Create API Token

Before using this action, you need to obtain a GarnetAI API token:

1. Register or log in to [GarnetAI](https://app.garnet.ai/)
2. Navigate to your account settings
3. Create a new API token with appropriate permissions
4. Save this token, as you'll need it in the next step

### 2. Add Token to Repository Secrets

Store your GarnetAI API token as a repository secret:

1. Go to your repository on GitHub
2. Navigate to **Settings > Secrets and variables > Actions**
3. Click "New repository secret"
4. Name: `GARNET_API_TOKEN`
5. Value: Your GarnetAI API token from step 1
6. Click "Add secret"

## Usage

### Basic Usage

Add the following to your workflow file (e.g., `.github/workflows/security-scan.yml`):

```yaml
name: Security Monitoring

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Jibril Security Scanner
        uses: garnet-org/action@v1
        with:
          api_token: ${{ secrets.GARNET_API_TOKEN }}
```

### Advanced Usage with Custom Parameters

For more control, you can customize the action with additional parameters:

```yaml
name: Security Monitoring

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Jibril Security Scanner
        uses: garnet-org/action@v1
        with:
          api_token: ${{ secrets.GARNET_API_TOKEN }}
          api_url: https://dev-api.garnet.ai
          policy_path: ./config/netpolicy.yaml
          garnetctl_version: 1.2.0
          jibril_version: 0.9.5
```

## Inputs

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `api_token` | API token for GarnetAI service | Yes | N/A |
| `api_url` | API URL for GarnetAI service | No | `https://api.garnet.ai` |
| `policy_path` | Path to save the network policy file | No | `./config/netpolicy.yaml` |
| `garnetctl_version` | Version of garnetctl CLI to download | No | `latest` |
| `jibril_version` | Jibril release version (without v prefix) | No | `0.0` |
| `debug` | Enable detailed debug output | No | `false` |

## How It Works

When this action runs, it:

1. Downloads the necessary tools from GitHub releases:
   - garnetctl from garnet-org/garnetctl-releases
   - Jibril loader from listendev/jibril-releases
2. Creates a GitHub context file with workflow information
3. Creates a Garnet agent using the GitHub context
4. Uses the configuration file from ./config/jibril.yaml
5. Retrieves the network policy for the repository and workflow
6. Starts the Jibril loader directly using sudo

The security monitoring runs in the background for the duration of your workflow, detecting suspicious activity. The configuration includes extensive detection events for file access, execution monitoring, and network peer analysis.

## Troubleshooting

If you encounter issues:

1. Verify your API token has the proper permissions
2. Check that your workflow has sudo access for running the loader
3. Ensure the agent can properly register with GarnetAI
4. Check that the specified versions of garnetctl and Jibril are available in their respective release repositories

For more detailed errors, check the GitHub Actions logs.

## License

MIT