#!/bin/bash
set -euo pipefail

#
# Global variables and defaults.
#

INSTPATH=${INSTALL_PATH:-"/usr/local/bin"}

TOKEN=${API_TOKEN:-"YOUR_TOKEN_HERE"}
API=${API_URL:-"https://api.garnet.ai"}

GARNETVER=${GARNETCTL_VERSION:-"latest"}
JIBRILVER=${JIBRIL_VERSION:-"0.0"}

PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
OS=$(uname -s)

#
# Sanity checks.
#

case "$OS" in
Linux)
	GARNET_OS="linux"
	;;
*)
	echo "Unsupported OS: $OS"
	exit 1
	;;
esac

case "$ARCH" in
x86_64)
	ALTARCH="x86_64"
	;;
aarch64 | arm64)
	ALTARCH="arm64"
	;;
*)
	echo "Unsupported architecture: $ARCH"
	exit 1
	;;
esac

if [[ "$GARNETVER" != "latest" ]]; then
	if [[ "$GARNETVER" != v* ]]; then
		GARNETVER="v$GARNETVER"
	fi
fi

if [[ "$JIBRILVER" != v* ]]; then
	JIBRILVER="v$JIBRILVER"
fi

#
# Main script execution.
#

echo "API server: $API"
echo "Garnet Control Version: $GARNETVER"
echo "Jibril Version: $JIBRILVER"

#### Download.

# Garnet Control.

PREFIX="https://github.com/garnet-org/garnetctl-releases/releases/"
URL="$PREFIX/download/$GARNETVER/garnetctl_${GARNET_OS}_${ALTARCH}.tar.gz"

if [ "$GARNETVER" = "latest" ]; then
	URL="$PREFIX/latest/download/garnetctl_${GARNET_OS}_${ALTARCH}.tar.gz"
fi

echo "Downloading garnetctl: $URL"

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
curl -sL "$URL" | tar -xz -C "$TMP_DIR"

if [[ -f "$TMP_DIR/garnetctl" ]]; then
	sudo mv "$TMP_DIR/garnetctl" $INSTPATH/garnetctl
	sudo chmod +x $INSTPATH/garnetctl
else
	echo "Failed to download garnetctl binary"
	exit 1
fi

# Jibril.

URL="https://github.com/garnet-org/jibril-releases/releases/download/$JIBRILVER/jibril"

echo "Downloading jibril: $URL"

sudo curl -sL -o $INSTPATH/jibril "$URL"
sudo chmod +x $INSTPATH/jibril

#### Configure.

echo "Configuring garnetctl"

$INSTPATH/garnetctl config set-baseurl "$API"
$INSTPATH/garnetctl config set-token "$TOKEN"

# Context.

echo "Creating github context"

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

# Agent.

echo "Creating github agent"

AGENT_INFO=$($INSTPATH/garnetctl create agent \
	--version "1.0.0" \
	--ip "127.0.0.1" \
	--machine-id "local-$(hostname)" \
	--kind github \
	--context-file github-context.json)

AGENT_ID=$(echo "$AGENT_INFO" | jq -r '.id')
AGENT_TOKEN=$(echo "$AGENT_INFO" | jq -r '.agent_token')

echo "Created agent with ID: $AGENT_ID"
export AGENT_TOKEN

# Network Policy.

REPO_ID="garnet-org/action"
WORKFLOW="Local Test Workflow"

echo "Fetching network policy for $REPO_ID/$WORKFLOW..."

$INSTPATH/garnetctl get network-policy merged \
	--repository-id "$REPO_ID" \
	--workflow-name "$WORKFLOW" \
	--format yaml \
	--output "/tmp/netpolicy.yaml"

echo "Saved the network policy to /tmp/netpolicy.yaml"
sudo head -n 20 /tmp/netpolicy.yaml || echo "No network policy file created"

# Install Jibril as a systemd service.
echo "Installing Jibril as a systemd service"
sudo -E $INSTPATH/jibril --systemd install

# Show all installed files.
echo "Verifying installed files"
sudo find /etc/jibril/ || echo "No files found in /etc/jibril/"

# Show configuration.
echo "Jibril configuration:"
sudo cat /etc/jibril/config.yaml || echo "No configuration file found"

# Show default network policy.
echo "Jibril network policy:"
sudo head -n 20 /etc/jibril/netpolicy.yaml || echo "No network policy file found"

# Jibril default environment file.

export GARNET_AGENT_TOKEN="$AGENT_TOKEN"

AI_ENABLED=${AI_ENABLED:-"false"}
AI_MODE=${AI_MODE:-"reason"}
AI_TOKEN=${AI_TOKEN:-""}
AI_MODEL=${AI_MODEL:-"gpt-4o"}
AI_TEMPERATURE=${AI_TEMPERATURE:-"0.3"}
GARNET_SAR=${GARNET_SAR:-"true"}

echo "Creating Jibril default environment file"

cat >/tmp/jibril.default <<EOF
AI_ENABLED=$AI_ENABLED
AI_MODE=$AI_MODE
AI_TOKEN=$AI_TOKEN
AI_MODEL=$AI_MODEL
AI_TEMPERATURE=$AI_TEMPERATURE
GARNET_AGENT_TOKEN=$GARNET_AGENT_TOKEN
GARNET_SAR=$GARNET_SAR
RUNNER_ARCH=X64
RUNNER_OS=Linux
GITHUB_TOKEN=$GITHUB_TOKEN
GITHUB_ACTOR=$GITHUB_ACTOR
GITHUB_ACTOR_ID=$GITHUB_ACTOR_ID
GITHUB_EVENT_NAME=$GITHUB_EVENT_NAME
GITHUB_JOB=$GITHUB_JOB
GITHUB_REF=$GITHUB_REF
GITHUB_REF_NAME=$GITHUB_REF_NAME
GITHUB_REF_PROTECTED=$GITHUB_REF_PROTECTED
GITHUB_REF_TYPE=$GITHUB_REF_TYPE
GITHUB_REPOSITORY=$GITHUB_REPOSITORY
GITHUB_REPOSITORY_ID=$GITHUB_REPOSITORY_ID
GITHUB_REPOSITORY_OWNER=$GITHUB_REPOSITORY_OWNER
GITHUB_REPOSITORY_OWNER_ID=$GITHUB_REPOSITORY_OWNER_ID
GITHUB_RUN_ATTEMPT=$GITHUB_RUN_ATTEMPT
GITHUB_RUN_ID=$GITHUB_RUN_ID
GITHUB_RUN_NUMBER=$GITHUB_RUN_NUMBER
GITHUB_SERVER_URL=$GITHUB_SERVER_URL
GITHUB_SHA=$GITHUB_SHA
GITHUB_TRIGGERING_ACTOR=$GITHUB_TRIGGERING_ACTOR
GITHUB_WORKFLOW=$GITHUB_WORKFLOW
GITHUB_WORKFLOW_REF=$GITHUB_WORKFLOW_REF
GITHUB_WORKFLOW_SHA=$GITHUB_WORKFLOW_SHA
GITHUB_WORKSPACE=$GITHUB_WORKSPACE
EOF

sudo -E install -D -o root -m 644 /tmp/jibril.default /etc/default/jibril

# Replace network policy.
sudo cp /tmp/netpolicy.yaml /etc/jibril/netpolicy.yaml
echo "New Jibril network policy:"
sudo head -n 20 /etc/jibril/netpolicy.yaml || echo "No network policy file found"

# Configure logging.
echo "StandardError=append:/var/log/jibril.err" | sudo tee -a /etc/systemd/system/jibril.service
echo "StandardOutput=append:/var/log/jibril.log" | sudo tee -a /etc/systemd/system/jibril.service

# Read systemd jibril service.
echo "Jibril systemd service file:"
sudo cat /etc/systemd/system/jibril.service || echo "No Jibril systemd service file found"

# Start Jibril service.

echo "Reloading systemd and enabling Jibril service:"
sudo -E systemctl daemon-reload
sudo -E systemctl enable jibril.service || true

echo "Starting Jibril service:"
sudo -E systemctl start jibril.service || sudo journalctl -xeu jibril.service

# Wait.
sleep 5

echo "Checking Jibril service status:"
sudo -E systemctl status jibril.service --no-pager || true

echo "Stopping Jibril service:"
sudo -E systemctl stop jibril.service || true

# Check logs.

echo "Jibril events log file:"
sudo cat /var/log/jibril.out || echo "No Jibril events log file found"

echo "Jibril log file:"
sudo cat /var/log/jibril.log || echo "No Jibril log file found"

echo "Jibril error file:"
sudo cat /var/log/jibril.err || echo "No Jibril error log file found"

if [[ $(cat /var/log/jibril.err | wc -l) -gt 0 ]]; then
	echo "Errors were found in the Jibril error log."
	exit 1
fi

echo "Test completed successfully."
