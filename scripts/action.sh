#!/bin/bash
set -e

# Default values
API_TOKEN=${API_TOKEN:-"YOUR_TOKEN_HERE"}
API_URL=${API_URL:-"https://api.garnet.ai"}
POLICY_PATH=${POLICY_PATH:-"./config/netpolicy.yaml"}
GARNETCTL_VERSION=${GARNETCTL_VERSION:-"latest"}
JIBRIL_VERSION=${JIBRIL_VERSION:-"0.0"}

# Print configuration
echo "Testing GarnetAI Action with:"
echo "  API URL: $API_URL"
echo "  Policy Path: $POLICY_PATH"
echo "  GarnetCtl Version: $GARNETCTL_VERSION"
echo "  Jibril Version: $JIBRIL_VERSION"

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

# Download Jibril loader
echo "Downloading Jibril loader $JIBRIL_VERSION..."

JIBRIL_URL="https://github.com/listendev/jibril-releases/releases/download/$JIBRIL_VERSION/loader"
echo "Downloading Jibril loader from: $JIBRIL_URL"
sudo curl -sL -o /usr/local/bin/loader "$JIBRIL_URL"
sudo chmod +x /usr/local/bin/loader

# Configure garnetctl
echo "Configuring garnetctl..."
garnetctl config set-baseurl "$API_URL"
garnetctl config set-token "$API_TOKEN"

# Step 2: Create GitHub context and agent
echo "=== Step 2: Create GitHub context and agent ==="

# Create a simulated GitHub context file
echo "Creating GitHub context file..."
cat > github-context.json << EOF
{
  "job": "local-test",
  "run_id": "123456789",
  "workflow": "Local Test Workflow",
  "repository": "garnet-org/action",
  "repository_owner": "garnet-org",
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
mkdir -p $(dirname "$POLICY_PATH")

# Get the network policy and save it to the specified path
echo "Fetching network policy for $REPO_ID/$WORKFLOW..."
garnetctl get network-policy merged \
  --repository-id "$REPO_ID" \
  --workflow-name "$WORKFLOW" \
  --format jibril \
  --output "$POLICY_PATH"

echo "Network policy saved to $POLICY_PATH"

# Step 4: Start Jibril with loader
echo "=== Step 4: Starting Jibril security monitoring ==="
export GARNET_AGENT_TOKEN="$AGENT_TOKEN"

echo "Running Jibril loader..."
echo "Command: sudo -E loader --config ./config/jibril.yaml --systemd enable-now"

# Prompt user before running with sudo
read -p "Ready to run Jibril with sudo. Continue? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  sudo -E loader --config ./config/jibril.yaml --systemd enable-now
  echo "Security monitoring installed and started"
else
  echo "Skipped running Jibril loader. You can run it manually with:"
  echo "  sudo -E loader --config ./config/jibril.yaml --systemd enable-now"
fi

echo "=== Test completed ==="
echo "To stop the Jibril service, you may need to find and stop the systemd service"