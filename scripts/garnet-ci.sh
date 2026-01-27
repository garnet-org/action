#!/bin/bash

# GarnetAI Security Scanner Action Script
# This script handles all steps of the security monitoring setup

# Track if any critical errors occurred
HAS_ERRORS=false

# Error handling function
handle_error() {
	local exit_code=$1
	local error_msg="$2"

	# Mark that we had an error
	HAS_ERRORS=true

	if [ "$CONTINUE_ON_ERROR" == "true" ]; then
		echo "::warning::$error_msg (Exit code: $exit_code)"
		echo "⚠️ WARNING: $error_msg - Continuing due to continue_on_error=true"

		if [ "$DEBUG" == "true" ]; then
			echo "DEBUG: Working directory: $(pwd)"
			echo "DEBUG: Environment variables related to this step:"
			env | grep -E "(GARNET|JIBRIL|API)" || true
		fi

		return 0
	else
		echo "::error::$error_msg (Exit code: $exit_code)"
		echo "❌ ERROR: $error_msg"
		exit $exit_code
	fi
}

# Parse input parameters
API_TOKEN="$1"
API_URL="$2"
GARNETCTL_VERSION="$3"
JIBRIL_VERSION="$4"
DEBUG="$5"
CONTINUE_ON_ERROR="$6"

# GitHub context variables
GITHUB_JOB="${GITHUB_JOB:-}"
GITHUB_RUN_ID="${GITHUB_RUN_ID:-}"
GITHUB_WORKFLOW="${GITHUB_WORKFLOW:-}"
GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-}"
GITHUB_REPOSITORY_ID="${GITHUB_REPOSITORY_ID:-}"
GITHUB_REPOSITORY_OWNER="${GITHUB_REPOSITORY_OWNER:-}"
GITHUB_REPOSITORY_OWNER_ID="${GITHUB_REPOSITORY_OWNER_ID:-}"
GITHUB_EVENT_NAME="${GITHUB_EVENT_NAME:-}"
GITHUB_REF="${GITHUB_REF:-}"
GITHUB_SHA="${GITHUB_SHA:-}"
GITHUB_ACTOR="${GITHUB_ACTOR:-}"
RUNNER_OS="${RUNNER_OS:-}"
RUNNER_ARCH="${RUNNER_ARCH:-}"
GITHUB_ACTION_PATH="${GITHUB_ACTION_PATH:-$(dirname "$0")/../}"

# Enable debug output if requested
if [ "$DEBUG" == "true" ]; then
	echo "DEBUG MODE ENABLED - Will provide detailed output"
	set -x
fi

# Show warning if continue_on_error is enabled
if [ "$CONTINUE_ON_ERROR" == "true" ]; then
	echo "::warning::continue_on_error is enabled - ALL errors will be logged as warnings but won't fail the action"
	echo "⚠️ WARNING: Running with continue_on_error=true - ALL command failures will be caught and logged"
fi

echo "🚀 Starting GarnetAI Security Scanner Setup..."

# =============================================================================
# STEP 1: Download and setup tools
# =============================================================================
echo "=== Step 1: Download and setup tools ==="

# Set up versions
echo "Using Garnetctl version: $GARNETCTL_VERSION"
echo "Using Jibril version: $JIBRIL_VERSION"

# Ensure we have the proper version format
if [[ "$GARNETCTL_VERSION" != "latest" && "$GARNETCTL_VERSION" != v* ]]; then
	GARNETCTL_VERSION="v$GARNETCTL_VERSION"
fi

if [[ "$JIBRIL_VERSION" != v* ]]; then
	JIBRIL_VERSION="v$JIBRIL_VERSION"
fi

# Map OS and arch to garnetctl release names
OS=$(uname -s)
ARCH=$(uname -m)

# Convert to garnetctl naming format
if [ "$OS" = "Linux" ]; then
	GARNET_OS="Linux"
elif [ "$OS" = "Darwin" ]; then
	GARNET_OS="Darwin"
else
	handle_error 1 "Unsupported OS: $OS"
fi

if [ "$ARCH" = "x86_64" ]; then
	GARNET_ARCH="x86_64"
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
	GARNET_ARCH="arm64"
else
	handle_error 1 "Unsupported architecture: $ARCH"
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
mv "$GARNETCTL_TMP_DIR/garnetctl" /usr/local/bin/garnetctl
chmod +x /usr/local/bin/garnetctl

# Clean up
rm -rf "$GARNETCTL_TMP_DIR"
echo "Garnetctl downloaded and installed successfully ✅"

# Download Jibril
echo "Downloading Jibril $JIBRIL_VERSION..."

JIBRIL_URL="https://github.com/garnet-org/jibril-releases/releases/download/$JIBRIL_VERSION/jibril"
echo "Downloading Jibril from: $JIBRIL_URL"
curl -sL -o /usr/local/bin/jibril "$JIBRIL_URL"
chmod +x /usr/local/bin/jibril

echo "Jibril downloaded and installed successfully ✅"

# Pre-flight checks for API configuration
echo "Validating API configuration..."

# Check API token first - exit early if missing
if [ -z "$API_TOKEN" ]; then
	handle_error 1 "api_token is required but was not provided. Please provide the api_token input parameter in your workflow file"
fi

# Check API URL and set default if needed
if [ -z "$API_URL" ]; then
	API_URL="https://api.garnet.ai"
	echo "::warning::api_url not specified, using default: $API_URL"
	echo "⚠️ WARNING: api_url not specified, using default: $API_URL"
fi

# Configure garnetctl with validated parameters
echo "Configuring garnetctl with URL: $API_URL"
garnetctl config set-baseurl "$API_URL"
echo "Configuring garnetctl with provided API token"
garnetctl config set-token "$API_TOKEN"
echo "Download and setup tools completed ✅"

# =============================================================================
# STEP 2: Create GitHub context and agent
# =============================================================================
echo "=== Step 2: Create GitHub context and agent ==="

# Get version from garnetctl
VERSION=$(garnetctl version | grep -oP 'Version: \K[^,]+')

# Get runner IP (fallback to localhost)
RUNNER_IP=$(hostname -I | awk '{print $1}')
RUNNER_IP=${RUNNER_IP:-127.0.0.1}

# Get machine ID or construct unique one
if [ -f /etc/machine-id ]; then
	SYSTEM_MACHINE_ID=$(cat /etc/machine-id)
elif [ -f /var/lib/dbus/machine-id ]; then
	SYSTEM_MACHINE_ID=$(cat /var/lib/dbus/machine-id)
else
	SYSTEM_MACHINE_ID=$(hostname)
fi

# Construct unique identifiers for this workflow job
MACHINE_ID="${SYSTEM_MACHINE_ID}"
HOSTNAME="$(hostname)-${GITHUB_RUN_ID}-${GITHUB_JOB}"

echo "Agent details:"
echo "  Version: $VERSION"
echo "  IP: $RUNNER_IP"
echo "  Hostname: $HOSTNAME"
echo "  Machine ID: $MACHINE_ID"

# Create the GitHub context file in a temporary directory
echo "Creating GitHub context file..."
TEMP_DIR=$(mktemp -d)
cat >"$TEMP_DIR/github-context.json" <<EOF
{
  "job": "$GITHUB_JOB",
  "run_id": "$GITHUB_RUN_ID",
  "workflow": "$GITHUB_WORKFLOW",
  "repository": "$GITHUB_REPOSITORY",
  "repository_id": "$GITHUB_REPOSITORY_ID",
  "repository_owner": "$GITHUB_REPOSITORY_OWNER",
  "repository_owner_id": "$GITHUB_REPOSITORY_OWNER_ID",
  "event_name": "$GITHUB_EVENT_NAME",
  "ref": "$GITHUB_REF",
  "sha": "$GITHUB_SHA",
  "actor": "$GITHUB_ACTOR",
  "runner_os": "$RUNNER_OS",
  "runner_arch": "$RUNNER_ARCH"
}
EOF

# Create the agent
echo "Creating GitHub agent..."
AGENT_INFO=$(garnetctl create agent \
	--version "$VERSION" \
	--ip "$RUNNER_IP" \
	--hostname "$HOSTNAME" \
	--machine-id "$MACHINE_ID" \
	--kind github \
	--context-file "$TEMP_DIR/github-context.json")

# Extract agent details
AGENT_ID=$(echo "$AGENT_INFO" | jq -r '.id')
AGENT_TOKEN=$(echo "$AGENT_INFO" | jq -r '.agent_token')

# Clean up temporary file
rm -f "$TEMP_DIR/github-context.json"
rmdir "$TEMP_DIR"

echo "Created agent with ID: $AGENT_ID"
echo "Step 2 completed ✅"

# =============================================================================
# STEP 3: Get network policy
# =============================================================================
echo "=== Step 3: Getting network policy ==="

REPO_ID="$GITHUB_REPOSITORY"
WORKFLOW="$GITHUB_WORKFLOW"

# Define action paths - use a temporary directory for policy files
TEMP_POLICY_DIR=$(mktemp -d)
echo "Creating temporary policy directory: $TEMP_POLICY_DIR"

# Debug: Show working directory and directory structure
if [ "$DEBUG" == "true" ]; then
	echo "DEBUG: Current working directory: $(pwd)"
	echo "DEBUG: Created temporary policy directory: $TEMP_POLICY_DIR"
	echo "DEBUG: GitHub Action path: $GITHUB_ACTION_PATH"
fi

# Get the network policy and save it to the specified path
echo "Fetching network policy for repository '$REPO_ID' and workflow '$WORKFLOW'..."
NETPOLICY_PATH="$TEMP_POLICY_DIR/netpolicy.yaml"
garnetctl get network-policy merged \
	--repository-id "$REPO_ID" \
	--workflow-name "$WORKFLOW" \
	--format yaml \
	--output "$NETPOLICY_PATH"

# Check if policy file was created successfully
if [ -f "$NETPOLICY_PATH" ]; then
	echo "Network policy saved to $NETPOLICY_PATH ✅"
	if [ "$DEBUG" == "true" ]; then
		echo "DEBUG: Network policy content:"
		cat "$NETPOLICY_PATH"
	fi
else
	echo "ERROR: Network policy file was not created at $NETPOLICY_PATH"
	if [ "$DEBUG" == "true" ]; then
		echo "DEBUG: Directory permissions:"
		ls -la "$TEMP_POLICY_DIR"
		echo "DEBUG: garnetctl version:"
		garnetctl --version
	fi
	# Clean up temporary directory before exiting
	rm -rf "$TEMP_POLICY_DIR"
	handle_error 1 "Network policy file was not created at $NETPOLICY_PATH"
fi

echo "Step 3 completed ✅"

# =============================================================================
# STEP 4: Setup environment
# =============================================================================
echo "=== Step 4: Setting up environment for security monitoring ==="

# Create systemd environment file for jibril service
echo "Creating environment file for systemd service..."
mkdir -p /tmp/jibril-env
echo "GARNET_AGENT_TOKEN=\"$AGENT_TOKEN\"" >/tmp/jibril-env/jibril
echo "GARNET_URL=\"$API_URL\"" >>/tmp/jibril-env/jibril
sudo mkdir -p /etc/default
sudo cp /tmp/jibril-env/jibril /etc/default/jibril
sudo chmod 644 /etc/default/jibril
rm -rf /tmp/jibril-env
echo "Step 4 completed ✅"

# =============================================================================
# STEP 5: Copy configuration files
# =============================================================================
echo "=== Step 5: Copying configuration files ==="

# Set up paths for configuration files
CONFIG_PATH="$GITHUB_ACTION_PATH/config/jibril.yaml"

echo "Using config from $CONFIG_PATH"
echo "Using netpolicy from $NETPOLICY_PATH"

# Debug information if requested
if [ "$DEBUG" == "true" ]; then
	echo "DEBUG: GITHUB_ACTION_PATH: ${GITHUB_ACTION_PATH}"
	echo "DEBUG: Current directory: $(pwd)"
	echo "DEBUG: Config file path: $CONFIG_PATH"
	echo "DEBUG: Netpolicy path: $NETPOLICY_PATH"

	if [ -f "$CONFIG_PATH" ]; then
		echo "DEBUG: jibril.yaml exists with size: $(stat -c %s "$CONFIG_PATH" 2>/dev/null || stat -f %z "$CONFIG_PATH" 2>/dev/null || echo "unknown")"
	else
		echo "DEBUG: jibril.yaml does not exist at $CONFIG_PATH"
	fi

	if [ -f "$NETPOLICY_PATH" ]; then
		echo "DEBUG: netpolicy.yaml exists with size: $(stat -c %s "$NETPOLICY_PATH" 2>/dev/null || stat -f %z "$NETPOLICY_PATH" 2>/dev/null || echo "unknown")"
	else
		echo "DEBUG: netpolicy.yaml does not exist at $NETPOLICY_PATH"
	fi
fi

# Copy config to /etc/jibril directory
echo "Copying configuration files to /etc/jibril/"
sudo mkdir -p /etc/jibril

# Copy config file
echo "Copying $CONFIG_PATH to /etc/jibril/config.yaml"
sudo cp "$CONFIG_PATH" /etc/jibril/config.yaml

# Copy netpolicy file with explicit path and check
if [ -f "$NETPOLICY_PATH" ]; then
	echo "Copying $NETPOLICY_PATH to /etc/jibril/netpolicy.yaml"
	sudo cp "$NETPOLICY_PATH" /etc/jibril/netpolicy.yaml
else
	echo "WARNING: $NETPOLICY_PATH does not exist"
	echo "Creating empty netpolicy file"
	sudo touch /etc/jibril/netpolicy.yaml
fi

# Set proper permissions
sudo chmod 644 /etc/jibril/config.yaml
sudo chmod 644 /etc/jibril/netpolicy.yaml

# Verify config files are in place before continuing
echo "Verifying configuration files are in place before starting service:"
if [ -f "/etc/jibril/config.yaml" ] && [ -f "/etc/jibril/netpolicy.yaml" ]; then
	echo "✅ Configuration files found in /etc/jibril/"
	echo "  - /etc/jibril/config.yaml"
	echo "  - /etc/jibril/netpolicy.yaml"
	echo "Step 5 completed ✅"
else
	echo "❌ Configuration files missing from /etc/jibril/"
	if [ ! -f "/etc/jibril/config.yaml" ]; then
		echo "  - Missing: /etc/jibril/config.yaml"
	fi
	if [ ! -f "/etc/jibril/netpolicy.yaml" ]; then
		echo "  - Missing: /etc/jibril/netpolicy.yaml"
	fi
	handle_error 1 "Cannot continue without proper configuration files"
fi

# Debug configuration if requested
if [ "$DEBUG" == "true" ]; then
	echo "DEBUG: Configuration files:"
	echo "  Original jibril config (config/jibril.yaml):"
	cat "$CONFIG_PATH"
	echo "  Original systemd service file ($GITHUB_ACTION_PATH/config/jibril.service):"
	cat "$GITHUB_ACTION_PATH/config/jibril.service" || echo "Service file not found"
	echo "  Installed config (/etc/jibril/config.yaml):"
	sudo cat /etc/jibril/config.yaml || echo "Service config file not found"
	echo "  Network policy (/etc/jibril/netpolicy.yaml):"
	sudo cat /etc/jibril/netpolicy.yaml || echo "Network policy file not found"
fi

# =============================================================================
# STEP 6: Install and start the service
# =============================================================================
echo "=== Step 6: Starting security monitoring service ==="

# Reload systemd after config changes
echo "Reloading systemd daemon to apply any configuration changes"
sudo systemctl daemon-reload

# Install systemd service file
echo "Installing systemd service file..."
SERVICE_FILE="$GITHUB_ACTION_PATH/config/jibril.service"
if [ -f "$SERVICE_FILE" ]; then
	echo "Copying service file from $SERVICE_FILE"
	sudo cp "$SERVICE_FILE" /etc/systemd/system/
else
	handle_error 1 "Service file not found at $SERVICE_FILE - cannot continue"
fi
sudo systemctl daemon-reload

# Check if the service is already running, if so restart it
if systemctl is-active --quiet jibril.service; then
	echo "Jibril service is already running, restarting with new configuration..."
	sudo systemctl restart jibril.service
	SERVICE_STARTED=true
else
	# Start the service
	echo "Starting jibril service..."
	if sudo systemctl start jibril.service; then
		sudo systemctl enable jibril.service
		SERVICE_STARTED=true
	else
		SERVICE_STARTED=false
	fi
fi

if [ "$SERVICE_STARTED" = "true" ]; then
	echo "Step 6 completed ✅ - Security monitoring started successfully"

	# Wait for the service to initialize
	echo "Waiting 5 seconds for jibril service to initialize..."
	sleep 5
else
	JIBRIL_EXIT=$?
	echo "ERROR: Failed to start Jibril. Exit code: $JIBRIL_EXIT"

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
		echo "DEBUG: jibril binary info:"
		ls -la /usr/local/bin/jibril || echo "Jibril binary not found"
		jibril --version || echo "Unable to get jibril version"
	fi

	handle_error $JIBRIL_EXIT "Failed to start Jibril"
fi

# =============================================================================
# STEP 7: Verify service is running properly
# =============================================================================
echo "=== Step 7: Verifying service status ==="

if [ "$DEBUG" == "true" ]; then
	echo "DEBUG: Checking service status after initialization period:"
	sudo systemctl status jibril.service || true

	echo "DEBUG: Checking for listening ports:"
	sudo ss -tlnp | grep -E 'jibril' || echo "No listening ports found"

	echo "DEBUG: Checking systemd service environment variables:"
	sudo systemctl show-environment jibril.service || echo "Unable to show service environment"

	echo "DEBUG: Checking service configuration:"
	sudo systemctl cat jibril.service || echo "Unable to show service configuration"
fi

# Final verification that service is running
if ! systemctl is-active --quiet jibril.service; then
	echo "ERROR: Jibril service is not running after initialization"

	if [ "$DEBUG" == "true" ]; then
		echo "DEBUG: Checking system logs for errors:"
		sudo journalctl -u jibril.service --no-pager -n 50 || echo "Unable to get journalctl logs"
		echo "DEBUG: Jibril version information:"
		jibril --version || echo "Unable to get jibril version"
		echo "DEBUG: Checking if systemd service was created:"
		sudo systemctl list-unit-files | grep jibril || echo "No jibril service found"
	fi

	# Clean up temporary directory
	if [ -n "$TEMP_POLICY_DIR" ] && [ -d "$TEMP_POLICY_DIR" ]; then
		rm -rf "$TEMP_POLICY_DIR"
	fi

	handle_error 1 "Jibril service is not running after initialization"
fi

# Clean up temporary directory
if [ -n "$TEMP_POLICY_DIR" ] && [ -d "$TEMP_POLICY_DIR" ]; then
	rm -rf "$TEMP_POLICY_DIR"
fi

if [ "$HAS_ERRORS" = "true" ]; then
	echo "Step 7 completed ⚠️ - Security monitoring setup finished with warnings"
	echo ""
	echo "⚠️ GarnetAI Security Scanner setup completed with errors!"
	echo "❌ Some components may not be running properly - check logs above"

	if [ "$CONTINUE_ON_ERROR" == "true" ]; then
		echo "✅ Action continued due to continue_on_error=true"
	fi
else
	echo "Step 7 completed ✅ - Security monitoring service is running successfully"
	echo ""
	echo "🎉 GarnetAI Security Scanner setup completed successfully!"
	echo "✅ All components are running and monitoring is active"
fi
