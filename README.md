# GarnetAI Security Monitoring

A GitHub Action that runs the GarnetAI event generator for security monitoring.

## Usage

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
      
      - name: Run GarnetAI Security Monitoring
        uses: garnet-org/action@v1
        with:
          api_token: ${{ secrets.GARNETAI_API_TOKEN }}
          api_url: ${{ secrets.GARNETAI_API_URL }} # Optional, defaults to https://api.garnet.ai
```

## Inputs

| Input | Description | Required | Default |
| ----- | ----------- | -------- | ------- |
| `api_token` | API token for GarnetAI service | Yes | N/A |
| `api_url` | API URL for GarnetAI service | No | `https://api.garnet.ai` |
| `version` | Docker image version to use | No | `latest` |

## What does this action do?

1. Runs the GarnetAI event generator
2. Sends security telemetry to the GarnetAI API
3. Provides runtime security monitoring for your workflow

## Docker Image

This action uses a pre-built Docker image `ghcr.io/garnet-org/action:latest` from GitHub Container Registry. The image is built using a multi-stage build process resulting in a minimal scratch-based container for maximum efficiency and security.

If you want to build the Docker image yourself:

```bash
# Clone the repository
git clone https://github.com/garnet-org/action.git
cd action

# Build and push the Docker image
./docker-build.sh
```

## Local Testing

For instructions on how to test this action locally, see [Local Testing Documentation](docs/local-testing.md).

## License

MIT
