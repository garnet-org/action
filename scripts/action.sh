#!/bin/bash
set -euo pipefail

#
# Inputs from environment variables (set by action.yaml).
# We use GARNET_* for the contract; TOKEN/API/GARNETVER/JIBRILVER are internal short names.
#

TOKEN="${GARNET_API_TOKEN:-}"
API="${GARNET_API_URL:-https://api.garnet.ai}"
GARNETVER="${GARNETCTL_VERSION:-latest}"
JIBRILVER="${JIBRIL_VERSION:-latest}"
DEBUG="${DEBUG:-false}"

if [ "$DEBUG" = "true" ]; then
	set -x
fi

#
# Global variables and defaults.
#

fail() {
	echo "${2:-Error}" >&2
	exit "${1:-1}"
}

INSTPATH="/usr/local/bin"

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
Darwin)
	GARNET_OS="darwin"
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

VERSION=$("$INSTPATH/garnetctl" version | grep -oP 'Version: \K[^,]+')

RUNNER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
RUNNER_IP=${RUNNER_IP:-127.0.0.1}

if [ -f /etc/machine-id ]; then
	SYSTEM_MACHINE_ID=$(cat /etc/machine-id)
elif [ -f /var/lib/dbus/machine-id ]; then
	SYSTEM_MACHINE_ID=$(cat /var/lib/dbus/machine-id)
else
	SYSTEM_MACHINE_ID=$(hostname)
fi

MACHINE_ID="$SYSTEM_MACHINE_ID"
HOSTNAME="$(hostname)-${GITHUB_RUN_ID:-}-${GITHUB_JOB:-}"

cat >"$TMP_DIR/github-context.json" <<EOF
{
  "job": "${GITHUB_JOB:-}",
  "run_id": "${GITHUB_RUN_ID:-}",
  "workflow": "${GITHUB_WORKFLOW:-}",
  "repository": "${GITHUB_REPOSITORY:-}",
  "repository_id": "${GITHUB_REPOSITORY_ID:-}",
  "repository_owner": "${GITHUB_REPOSITORY_OWNER:-}",
  "repository_owner_id": "${GITHUB_REPOSITORY_OWNER_ID:-}",
  "event_name": "${GITHUB_EVENT_NAME:-}",
  "ref": "${GITHUB_REF:-}",
  "sha": "${GITHUB_SHA:-}",
  "actor": "${GITHUB_ACTOR:-}",
  "runner_os": "${RUNNER_OS:-}",
  "runner_arch": "${RUNNER_ARCH:-}"
}
EOF

# Agent.

echo "Creating github agent"

AGENT_INFO=$("$INSTPATH/garnetctl" create agent \
	--version "$VERSION" \
	--ip "$RUNNER_IP" \
	--hostname "$HOSTNAME" \
	--machine-id "$MACHINE_ID" \
	--kind github \
	--context-file "$TMP_DIR/github-context.json") || fail $? "Failed to create agent"

AGENT_ID=$(echo "$AGENT_INFO" | jq -r '.id' 2>/dev/null)
AGENT_TOKEN=$(echo "$AGENT_INFO" | jq -r '.agent_token')

echo "Created agent with ID: $AGENT_ID"
export AGENT_TOKEN

# Network Policy.

echo "Getting network policy"

REPO_ID="${GITHUB_REPOSITORY:-}"
WORKFLOW="${GITHUB_WORKFLOW:-}"

NETPOLICY_PATH="$TMP_DIR/netpolicy.yaml"

echo "Fetching network policy for $REPO_ID/$WORKFLOW..."

"$INSTPATH/garnetctl" get network-policy merged \
	--repository-id "$REPO_ID" \
	--workflow-name "$WORKFLOW" \
	--format yaml \
	--output "$NETPOLICY_PATH" || fail $? "Failed to fetch network policy"

if [ ! -f "$NETPOLICY_PATH" ]; then
	fail 1 "Network policy file was not created"
fi

echo "Network policy saved to $NETPOLICY_PATH"
if [[ "$DEBUG" = "true" ]]; then
	head -n 20 "$NETPOLICY_PATH" || true
fi

echo "Installing obtained network policy to /etc/jibril/netpolicy.yaml"

#### Jibril runtime setup.

export GARNET_API_URL="$API"
export GARNET_API_TOKEN="$TOKEN"
export GARNET_AGENT_TOKEN="$AGENT_TOKEN"

echo "Creating Jibril default environment file"

cat >"$TMP_DIR/jibril.default" <<EOF
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
RUNNER_ARCH=${RUNNER_ARCH:-}
RUNNER_OS=${RUNNER_OS:-}
# Jibril writes profile markdown to this file
JIBRIL_PROFILER_FILE=${GITHUB_STEP_SUMMARY:-}
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

echo "Installing default environment file to /etc/default/jibril"
sudo -E install -D -o root -m 644 "$TMP_DIR/jibril.default" /etc/default/jibril

# Verify default environment file.
if [[ "$DEBUG" = "true" ]]; then
	echo "Default environment file:"
	sudo cat /etc/default/jibril || echo "No default environment file found"
fi

echo "Installing Jibril as a systemd service"
sudo -E "$INSTPATH/jibril" --systemd install

# Configure logging using a systemd drop-in override.
sudo mkdir -p /etc/systemd/system/jibril.service.d
cat <<EOF | sudo tee /etc/systemd/system/jibril.service.d/logging.conf >/dev/null
[Service]
StandardError=append:/var/log/jibril.err
StandardOutput=append:/var/log/jibril.log
EOF

# Verify installed files.
if [[ "$DEBUG" = "true" ]]; then
	echo "Jibril installed files:"
	sudo find /etc/jibril/ || echo "No files found in /etc/jibril/"
fi

# Verify configuration.
if [[ "$DEBUG" = "true" ]]; then
	echo "Jibril configuration:"
	sudo cat /etc/jibril/config.yaml || echo "No configuration file found"
fi

# Verify network policy.
if [[ "$DEBUG" = "true" ]]; then
	echo "Jibril default network policy:"
	sudo head -n 20 /etc/jibril/netpolicy.yaml || echo "No network policy file found"
fi

# Replace network policy with fetched one.
sudo cp -v "$NETPOLICY_PATH" /etc/jibril/netpolicy.yaml
if [[ "$DEBUG" = "true" ]]; then
	echo "Replaced Jibril network policy:"
	sudo head -n 20 /etc/jibril/netpolicy.yaml || echo "No network policy file found"
fi

# Reload systemd and start Jibril service.
if [[ "$DEBUG" = "true" ]]; then
	echo "Reloading systemd and enabling Jibril service..."
fi

sudo -E systemctl daemon-reload
sudo -E systemctl enable jibril.service || true

if [[ "$DEBUG" = "true" ]]; then
	echo "Starting Jibril service..."
fi

# Start Jibril service.
sudo -E systemctl start jibril.service
return_code=$?

# Check journal logs for errors.
if [ $return_code -ne 0 ]; then
	if [[ "$DEBUG" = "true" ]]; then
		sudo journalctl -xeu jibril.service
	fi
	exit 1
fi

sleep 5

# Check Jibril service status.
if [[ "$DEBUG" = "true" ]]; then
	echo "Checking Jibril service status..."
	sudo -E systemctl status jibril.service --no-pager
fi
