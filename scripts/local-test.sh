#!/bin/bash
set -e

# Default values
API_TOKEN=${API_TOKEN:-"YOUR_TOKEN_HERE"}
API_URL=${API_URL:-"https://api.garnet.ai"}
GARNETCTL_VERSION=${GARNETCTL_VERSION:-"latest"}
JIBRIL_VERSION=${JIBRIL_VERSION:-"0.0"}
DEBUG=${DEBUG:-"false"}

# Enable debug output if requested
if [ "$DEBUG" == "true" ]; then
	echo "DEBUG MODE ENABLED - Will provide detailed output"
	set -x
fi

# Print configuration
echo "Testing GarnetAI Action with:"
echo "  API URL: $API_URL"
echo "  GarnetCtl Version: $GARNETCTL_VERSION"
echo "  Jibril Version: $JIBRIL_VERSION"
echo "  Debug: $DEBUG"

# Step 1: Download and setup tools
echo "=== Step 1: Download and setup tools ==="

# Ensure we have the proper version format
if [[ "$GARNETCTL_VERSION" != "latest" && "$GARNETCTL_VERSION" != v* ]]; then
	GARNETCTL_VERSION="v$GARNETCTL_VERSION"
fi

if [[ "$JIBRIL_VERSION" != v* ]]; then
	JIBRIL_VERSION="v$JIBRIL_VERSION"
fi

# Platform detection
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Download garnetctl from GitHub
echo "Downloading garnetctl $GARNETCTL_VERSION..."

# Map OS and arch to garnetctl release names
OS=$(uname -s)
ARCH=$(uname -m)

# Convert to garnetctl naming format
if [ "$OS" = "Linux" ]; then
	GARNET_OS="Linux"
elif [ "$OS" = "Darwin" ]; then
	GARNET_OS="Darwin"
else
	echo "Unsupported OS: $OS"
	exit 1
fi

if [ "$ARCH" = "x86_64" ]; then
	GARNET_ARCH="x86_64"
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
	GARNET_ARCH="arm64"
else
	echo "Unsupported architecture: $ARCH"
	exit 1
fi

# Construct download URL
if [ "$GARNETCTL_VERSION" = "latest" ]; then
	GARNETCTL_URL="https://github.com/garnet-org/garnetctl-releases/releases/latest/download/garnetctl_${GARNET_OS}_${GARNET_ARCH}.tar.gz"
else
	GARNETCTL_URL="https://github.com/garnet-org/garnetctl-releases/releases/download/$GARNETCTL_VERSION/garnetctl_${GARNET_OS}_${GARNET_ARCH}.tar.gz"
fi

echo "Downloading garnetctl from: $GARNETCTL_URL"

# Create temporary directory for extraction
GARNETCTL_TMP_DIR=$(mktemp -d)

# Download and extract
curl -sL "$GARNETCTL_URL" | tar -xz -C "$GARNETCTL_TMP_DIR"

# Move binary to path
sudo mv "$GARNETCTL_TMP_DIR/garnetctl" /usr/local/bin/garnetctl
sudo chmod +x /usr/local/bin/garnetctl

# Clean up
rm -rf "$GARNETCTL_TMP_DIR"

# Download Jibril
echo "Downloading Jibril $JIBRIL_VERSION..."

JIBRIL_URL="https://github.com/garnet-org/jibril-releases/releases/download/$JIBRIL_VERSION/jibril"
echo "Downloading Jibril from: $JIBRIL_URL"
sudo curl -sL -o /usr/local/bin/jibril "$JIBRIL_URL"
sudo chmod +x /usr/local/bin/jibril

# Configure garnetctl
echo "Configuring garnetctl..."
garnetctl config set-baseurl "$API_URL"
garnetctl config set-token "$API_TOKEN"

# Step 2: Create GitHub context and agent
echo "=== Step 2: Create GitHub context and agent ==="

# Create a simulated GitHub context file
echo "Creating GitHub context file..."
cat >github-context.json <<EOF
{
  "job": "local-test",
  "run_id": "123456789",
  "workflow": "Local Test Workflow",
  "repository": "garnet-org/action",
  "repository_id": "12345678",
  "repository_owner": "garnet-org",
  "repository_owner_id": "87654321",
  "event_name": "local-test",
  "ref": "refs/heads/main",
  "sha": "$(git rev-parse HEAD || echo "0000000000000000000000000000000000000000")",
  "actor": "$(whoami)",
  "runner_os": "$PLATFORM",
  "runner_arch": "$ARCH"
}
EOF

echo "Creating GitHub agent..."
AGENT_INFO=$(garnetctl create agent \
	--version "1.0.0" \
	--ip "127.0.0.1" \
	--machine-id "local-$(hostname)" \
	--kind github \
	--context-file github-context.json)

# Extract agent details
AGENT_ID=$(echo "$AGENT_INFO" | jq -r '.id')
AGENT_TOKEN=$(echo "$AGENT_INFO" | jq -r '.agent_token')

echo "Created agent with ID: $AGENT_ID"
export AGENT_TOKEN

# Step 3: Configure and start monitoring
echo "=== Step 3: Configure and start monitoring ==="

# Get network policy
echo "Getting network policy..."
REPO_ID="garnet-org/action"
WORKFLOW="Local Test Workflow"

# Create directory for policy file if it doesn't exist
mkdir -p ./config

# Get the network policy and save it to the specified path
echo "Fetching network policy for $REPO_ID/$WORKFLOW..."
garnetctl get network-policy merged \
	--repository-id "$REPO_ID" \
	--workflow-name "$WORKFLOW" \
	--format jibril \
	--output "./config/netpolicy.yaml"

echo "Network policy saved to ./config/netpolicy.yaml"

# Step 4: Start Jibri
echo "=== Step 4: Starting Jibril security monitoring ==="
export GARNET_AGENT_TOKEN="$AGENT_TOKEN"

echo "Running Jibril..."
# sudo -E jibril --systemd install
# sudo cp ./config/jibril.yaml /etc/jibril/jibril.yaml
# sudo cp ./config/netpolicy.yaml /etc/jibril/netpolicy.yaml

# Prompt user before running with sudo
read -p "Ready to run Jibril with sudo. Continue? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
	if sudo -E jibril --systemd enable-now; then
		echo "Security monitoring installed and started"

		# Wait for service to initialize
		echo "Waiting 5 seconds for service to initialize..."
		sleep 5

		# Check service status
		if systemctl is-active --quiet jibril.service; then
			echo "✅ Jibril service is running successfully"
		else
			echo "❌ Jibril service failed to start"

			if [ "$DEBUG" == "true" ]; then
				echo "DEBUG: Service startup failed - collecting diagnostic information:"
				echo "DEBUG: Service status:"
				sudo systemctl status jibril.service || true
				echo "DEBUG: Service logs (last 50 lines):"
				sudo journalctl -xeu jibril.service --no-pager -n 50 || true
				echo "DEBUG: Environment file contents:"
				sudo cat /etc/default/jibril || echo "Environment file not found"
				echo "DEBUG: Configuration files:"
				sudo ls -la /etc/jibril/ || echo "Config directory not found"
				echo "DEBUG: Jibril binary info:"
				ls -la /usr/local/bin/jibril || echo "Jibril binary not found"
				jibril --version || echo "Unable to get jibril version"
			fi

			exit 1
		fi
	else
		echo "❌ Failed to install/start Jibril"

		if [ "$DEBUG" == "true" ]; then
			echo "DEBUG: Installation failed - collecting diagnostic information:"
			echo "DEBUG: Jibril binary info:"
			ls -la /usr/local/bin/jibril || echo "Jibril binary not found"
			jibril --version || echo "Unable to get jibril version"
			echo "DEBUG: Configuration files:"
			ls -la ./config/ || echo "Config directory not found"
		fi

		exit 1
	fi
else
	echo "Skipped running Jibril. You can run it manually with:"
	echo "  sudo -E jibril --systemd enable-now"
fi

echo "=== Test completed ==="
echo "To stop the Jibril service, you may need to find and stop the systemd service"
