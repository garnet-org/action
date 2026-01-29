# 🛡️ Garnet Runtime Security

> **Protect your workflows with real-time runtime security monitoring** ⚡

The **Garnet Runtime Security** Action integrates the [Jibril security scanner](https://jibril.garnet.ai) and both [Garnet Backend and Dashboard](https://dashboard.garnet.ai) to provide comprehensive runtime threat detection directly in your GitHub Actions workflows. Detect suspicious activity, network connections, and potential security threats as your workflow runs.

## ✨ Features

- 🚀 **Seamless Integration** - Easy to add to any workflow
- 🔭 **Runtime Detection** - Monitors your workflow as it executes
- 🔍 **Extensive Monitoring** - File access, execution, and network analysis
- 🌐 **Network Policy Enforcement** - Block suspicious connections automatically
- 📋 **Detailed Logging** - View comprehensive security information

## 🚀 Getting Started

### 1️⃣ Create API Token

Before using this action, you need to obtain a Garnet API token:

1. Register or log in to [Garnet](https://app.garnet.ai/)
2. Navigate to your account settings
3. Create a new API token with appropriate permissions
4. Save this token for the next step

### 2️⃣ Add Token to Repository Secrets

Store your Garnet API token as a repository secret:

1. Go to your repository on GitHub
2. Navigate to **Settings > Secrets and variables > Actions**
3. Click "New repository secret"
4. Name: `GARNET_API_TOKEN`
5. Value: Your Garnet API token from step 1
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

      - name: Garnet Runtime Security
        uses: garnet-org/action@v1
        with:
          api_token: ${{ secrets.GARNET_API_TOKEN }}
```

## ⚙️ Configuration Options

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| `api_token` | API token for GarnetAI service | Yes | N/A |
| `api_url` | API URL for GarnetAI service | No | `https://api.garnet.ai` |
| `garnetctl_version` | Version of garnetctl CLI to download | No | `latest` |
| `jibril_version` | Jibril release version (without v prefix) | No | `2.9.1` |
| `debug` | Enable detailed debug output | No | `false` |

## 📜 License

MIT

---

<div align="center">
  <a href="https://garnet.ai">
    <img src="https://garnet.ai/wp-content/uploads/2023/06/logo_dark.svg" alt="Garnet" width="200" height="40">
  </a>
  <p>
    <sub>Made with ❤️ by the Garnet team</sub>
  </p>
</div>
