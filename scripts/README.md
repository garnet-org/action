# GarnetAI Action Test Script

This script (`local-test.sh`) allows you to test the GarnetAI GitHub Action locally without having to run it in a GitHub Actions workflow.

## Prerequisites

- bash
- curl
- jq
- git
- sudo access

## Usage

1. Make the script executable if needed:

   ```bash
   chmod +x local-test.sh
   ```

2. Set environment variables to configure the script:

   ```bash
   export API_TOKEN="your-garnet-api-token"
   export API_URL="https://api.garnet.ai"  # Optional, default is shown
   export GARNETCTL_VERSION="latest"  # Optional, default is shown
   export JIBRIL_VERSION="0.0"  # Optional, default is shown
   ```

3. Run the script:

   ```bash
   sudo ./local-test.sh
   ```

## What the Script Does

The script mimics the behavior of the GitHub Action:

1. Downloads garnetctl from GitHub releases
2. Downloads the Jibril loader from GitHub releases
3. Creates a simulated GitHub context
4. Creates a Garnet agent
5. Fetches a network policy
6. Runs Jibril with sudo using the config from `./config/jibril.yaml`

## Cleanup

The script will run Jibril with `--systemd`, which means it will be installed as a systemd service. To stop and remove the service after testing, you may need to:

1. Find the service name:

   ```bash
   sudo systemctl list-units | grep jibril
   ```

2. Stop and disable the service:

   ```bash
   sudo systemctl stop <service-name>
   sudo systemctl disable <service-name>
   ```

## Troubleshooting

- Make sure you have a valid API token
- Verify you have sudo access
- Check Garnet and Jibril versions compatibility
- Make sure `./config/jibril.yaml` is correctly formatted
- Review logs:
  - `/var/log/jibril.log`
  - `/var/log/jibril.err`
  - `/var/log/jibril.events`
