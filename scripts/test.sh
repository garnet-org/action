#!/bin/bash
set -euo pipefail

#
# Inputs from environment variables (same names as action.yaml for compatibility).
# GARNET_* are the canonical names; TOKEN/API/GARNETVER/JIBRILVER are internal short names.
# For local runs you can set GARNET_API_TOKEN (or legacy API_TOKEN) and GARNET_API_URL (or API_URL).
#

TOKEN="${GARNET_API_TOKEN:-${API_TOKEN:-}}"
API="${GARNET_API_URL:-${API_URL:-https://dev-api.garnet.ai}}"
GARNETVER="${GARNETCTL_VERSION:-latest}"
JIBRILVER="${JIBRIL_VERSION:-latest}"
DEBUG="${DEBUG:-false}"

if [ "$DEBUG" = "true" ]; then
	set -x
fi

#
# Global variables and defaults.
#

INSTPATH="${INSTALL_PATH:-/usr/local/bin}"

PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
OS=$(uname -s)

#
# Sanity checks.
#

if [ -z "$TOKEN" ]; then
	echo "API token is required"
	exit 1
fi

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

if [[ "$GARNETVER" != "latest" && "$GARNETVER" != v* ]]; then
	GARNETVER="v$GARNETVER"
fi

if [[ "$JIBRILVER" != "latest" && "$JIBRILVER" != v* ]]; then
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

PREFIX="https://github.com/garnet-org/garnetctl-releases/releases"
URL="$PREFIX/download/$GARNETVER/garnetctl_${GARNET_OS}_${ALTARCH}.tar.gz"

if [ "$GARNETVER" = "latest" ]; then
	URL="$PREFIX/latest/download/garnetctl_${GARNET_OS}_${ALTARCH}.tar.gz"
fi

echo "Downloading garnetctl: $URL"

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
curl -sL "$URL" | tar -xz -C "$TMP_DIR"

if [[ -f "$TMP_DIR/garnetctl" ]]; then
	sudo mv "$TMP_DIR/garnetctl" "$INSTPATH/garnetctl"
	sudo chmod +x "$INSTPATH/garnetctl"
else
	echo "Failed to download garnetctl binary"
	exit 1
fi

# Jibril.

PREFIX="https://github.com/garnet-org/jibril-releases/releases"
URL="$PREFIX/download/$JIBRILVER/jibril"

if [ "$JIBRILVER" = "latest" ]; then
	URL="$PREFIX/latest/download/jibril"
fi

echo "Downloading jibril: $URL"

sudo curl -sL -o "$INSTPATH/jibril" "$URL"
sudo chmod +x "$INSTPATH/jibril"

#### Configure.

echo "Configuring garnetctl"

"$INSTPATH/garnetctl" config set-baseurl "$API"
"$INSTPATH/garnetctl" config set-token "$TOKEN"

# Context.

echo "Creating github context"

cat >"$TMP_DIR/github-context.json" <<EOF
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

AGENT_INFO=$("$INSTPATH/garnetctl" create agent \
	--version "1.0.0" \
	--ip "127.0.0.1" \
	--machine-id "local-$(hostname)" \
	--kind github \
	--context-file "$TMP_DIR/github-context.json")

AGENT_ID=$(echo "$AGENT_INFO" | jq -r '.id')
AGENT_TOKEN=$(echo "$AGENT_INFO" | jq -r '.agent_token')

echo "Created agent with ID: $AGENT_ID"
export AGENT_TOKEN

# Network Policy.

REPO_ID="garnet-org/action"
WORKFLOW="Local Test Workflow"

echo "Fetching network policy for $REPO_ID/$WORKFLOW..."

"$INSTPATH/garnetctl" get network-policy merged \
	--repository-id "$REPO_ID" \
	--workflow-name "$WORKFLOW" \
	--format yaml \
	--output "/tmp/netpolicy.yaml"

echo "Saved the network policy to /tmp/netpolicy.yaml"
sudo head -n 20 /tmp/netpolicy.yaml || echo "No network policy file created"

# Jibril default environment file.

export GARNET_API_URL="$API"
export GARNET_API_TOKEN="$TOKEN"
export GARNET_AGENT_TOKEN="$AGENT_TOKEN"

echo "Creating Jibril default environment file"

cat >/tmp/jibril.default <<EOF
# Garnet API configuration
GARNET_API_URL=${GARNET_API_URL}
GARNET_API_TOKEN=${GARNET_API_TOKEN}
GARNET_AGENT_TOKEN=${GARNET_AGENT_TOKEN}
GARNET_SAR=${GARNET_SAR:-true}
# AI configuration
AI_ENABLED=${AI_ENABLED:-false}
AI_MODE=${AI_MODE:-reason}
AI_TOKEN=${AI_TOKEN:-}
AI_MODEL=${AI_MODEL:-gpt-4o}
AI_TEMPERATURE=${AI_TEMPERATURE:-0.3}
# Runner information
RUNNER_ARCH=${RUNNER_ARCH:-X64}
RUNNER_OS=${RUNNER_OS:-Linux}
# Jibril writes profile markdown to these files (one per printer)
JIBRIL_PROFILER_FILE=${JIBRIL_PROFILER_FILE:-/var/log/jibril.profiler.out}
JIBRIL_PROFILER4FUN_FILE=${JIBRIL_PROFILER4FUN_FILE:-/var/log/jibril.profiler4fun.out}
# GitHub context
GITHUB_ACTION=${GITHUB_ACTION:-__run}
GITHUB_ACTOR_ID=${GITHUB_ACTOR_ID:-}
GITHUB_ACTOR=${GITHUB_ACTOR:-}
GITHUB_EVENT_NAME=${GITHUB_EVENT_NAME:-}
GITHUB_JOB=${GITHUB_JOB:-}
GITHUB_REF_NAME=${GITHUB_REF_NAME:-}
GITHUB_REF_PROTECTED=${GITHUB_REF_PROTECTED:-}
GITHUB_REF_TYPE=${GITHUB_REF_TYPE:-}
GITHUB_REF=${GITHUB_REF:-}
GITHUB_REPOSITORY_ID=${GITHUB_REPOSITORY_ID:-}
GITHUB_REPOSITORY_OWNER_ID=${GITHUB_REPOSITORY_OWNER_ID:-}
GITHUB_REPOSITORY_OWNER=${GITHUB_REPOSITORY_OWNER:-}
GITHUB_REPOSITORY=${GITHUB_REPOSITORY:-}
GITHUB_RUN_ATTEMPT=${GITHUB_RUN_ATTEMPT:-}
GITHUB_RUN_ID=${GITHUB_RUN_ID:-}
GITHUB_RUN_NUMBER=${GITHUB_RUN_NUMBER:-}
GITHUB_SERVER_URL=${GITHUB_SERVER_URL:-}
GITHUB_SHA=${GITHUB_SHA:-}
GITHUB_STEP_SUMMARY=${GITHUB_STEP_SUMMARY:-}
GITHUB_TOKEN=${GITHUB_TOKEN:-}
GITHUB_TRIGGERING_ACTOR=${GITHUB_TRIGGERING_ACTOR:-}
GITHUB_WORKFLOW_REF=${GITHUB_WORKFLOW_REF:-}
GITHUB_WORKFLOW_SHA=${GITHUB_WORKFLOW_SHA:-}
GITHUB_WORKFLOW=${GITHUB_WORKFLOW:-}
GITHUB_WORKSPACE=${GITHUB_WORKSPACE:-}
EOF

sudo -E install -D -o root -m 644 /tmp/jibril.default /etc/default/jibril

# Verify default environment file.
echo "Default environment file:"
sudo cat /etc/default/jibril || echo "No default environment file found"

# Install Jibril as a systemd service.
echo "Installing Jibril as a systemd service"
sudo -E "$INSTPATH/jibril" --systemd install

# Configure logging using a systemd drop-in override.
sudo mkdir -p /etc/systemd/system/jibril.service.d
cat <<EOF | sudo tee /etc/systemd/system/jibril.service.d/logging.conf
[Service]
StandardError=append:/var/log/jibril.err
StandardOutput=append:/var/log/jibril.log
EOF

# Verify installed files.
echo "Jibril installed files:"
sudo find /etc/jibril/ || echo "No files found in /etc/jibril/"

# Verify configuration.
echo "Jibril configuration:"
sudo cat /etc/jibril/config.yaml || echo "No configuration file found"

# Verify network policy.
echo "Jibril default network policy:"
sudo head -n 20 /etc/jibril/netpolicy.yaml || echo "No network policy file found"

# Replace network policy with fetched one.
sudo cp -v /tmp/netpolicy.yaml /etc/jibril/netpolicy.yaml
echo "Replaced Jibril network policy:"
sudo head -n 20 /etc/jibril/netpolicy.yaml || echo "No network policy file found"

# Reload systemd and start Jibril service.
echo "Reloading systemd and enabling Jibril service:"
sudo -E systemctl daemon-reload
sudo -E systemctl enable jibril.service || true

echo "Starting Jibril service:"
sudo -E systemctl start jibril.service
return_code=$?

# Check journal logs for errors.
if [ $return_code -ne 0 ]; then
	sudo journalctl -xeu jibril.service
	exit 1
fi

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

if [[ $(sudo cat /var/log/jibril.err 2>/dev/null | wc -l) -gt 0 ]]; then
	echo "Errors were found in the Jibril error log."
	exit 1
fi

echo "Test completed successfully."
