# 🛡️ GarnetAI Security Scanner GitHub Action

<div align="center">

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/garnet-org/action?style=for-the-badge)](https://github.com/garnet-org/action/releases)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/garnet-org/action/run.yml?style=for-the-badge)](https://github.com/garnet-org/action/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://github.com/garnet-org/action/blob/main/LICENSE)

</div>

> **Protect your workflows with real-time runtime security monitoring** ⚡

This powerful GitHub Action integrates the [Jibril security scanner](https://garnet.ai) to provide comprehensive runtime threat detection directly in your GitHub Actions workflows. Detect suspicious activity, network connections, and potential security threats as your workflow runs.

## ✨ Features

- 🚀 **Seamless Integration** - Easy to add to any workflow
- 🔭 **Runtime Detection** - Monitors your workflow as it executes
- 🔍 **Extensive Monitoring** - File access, execution, and network analysis
- 🌐 **Network Policy Enforcement** - Block suspicious connections automatically
- 📋 **Detailed Logging** - View comprehensive security information

## 🚀 Getting Started

### 1️⃣ Create API Token

Before using this action, you need to obtain a GarnetAI API token:

1. Register or log in to [GarnetAI](https://app.garnet.ai/)
2. Navigate to your account settings
3. Create a new API token with appropriate permissions
4. Save this token for the next step

### 2️⃣ Add Token to Repository Secrets

Store your GarnetAI API token as a repository secret:

1. Go to your repository on GitHub
2. Navigate to **Settings > Secrets and variables > Actions**
3. Click "New repository secret"
4. Name: `GARNET_API_TOKEN`
5. Value: Your GarnetAI API token from step 1
6. Click "Add secret"

## 📋 Usage

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

      - name: Run GarnetAI Security Scanner
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

      - name: Run GarnetAI Security Scanner
        uses: garnet-org/action@v1
        with:
          api_token: ${{ secrets.GARNET_API_TOKEN }}
          api_url: https://api.garnet.ai
          garnetctl_version: 1.2.0
          jibril_version: 0.9.5
          debug: true
```

## ⚙️ Configuration Options

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `api_token` | API token for GarnetAI service | Yes | N/A |
| `api_url` | API URL for GarnetAI service | No | `https://api.garnet.ai` |
| `garnetctl_version` | Version of garnetctl CLI to download | No | `latest` |
| `jibril_version` | Jibril release version (without v prefix) | No | `0.0` |
| `debug` | Enable detailed debug output | No | `false` |

## 🔍 How It Works

When this action runs, it follows these steps:

1. ⬇️ **Downloads required tools** - Fetches garnetctl and Jibril loader
2. 📝 **Creates context** - Builds GitHub context with workflow information
3. 🔑 **Registers agent** - Creates a Garnet agent for this workflow run
4. 📋 **Configures monitoring** - Uses the configuration file from ./config/loader.yaml
5. 🛡️ **Gets policy** - Retrieves the network policy for the repository and workflow
6. 🚀 **Starts scanner** - Launches the Jibril loader as a systemd service

The security monitoring runs in the background for the duration of your workflow, detecting suspicious activity. The configuration includes extensive detection events for file access, execution monitoring, and network peer analysis.

## 🔧 Troubleshooting

If you encounter issues:

- ✅ Verify your API token has the proper permissions
- ✅ Check that your workflow has sudo access for running the loader
- ✅ Ensure the agent can properly register with GarnetAI
- ✅ Check logs in the GitHub Actions output for detailed information

## 📚 Learn More

- [GarnetAI Platform](https://garnet.ai)
- [API Documentation](https://api.garnet.ai/docs)
- [Security Best Practices](https://garnet.ai/blog/security-best-practices)

## 📜 License

MIT

---

<div align="center">
  <a href="https://garnet.ai">
    <img src="https://garnet.ai/wp-content/uploads/2023/06/logo_dark.svg" alt="GarnetAI" width="200" height="40">
  </a>
  <p>
    <sub>Made with ❤️ by the GarnetAI team</sub>
  </p>
</div>
