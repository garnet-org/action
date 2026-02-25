#!/bin/bash
# render-markdown.sh -- Pure function: reads profile.json, outputs markdown to stdout.
#
# Usage:
#   ./render-markdown.sh /path/to/profile.json
#   cat profile.json | ./render-markdown.sh
#
# Requires: jq (available on all GitHub runners)
# Outputs: Markdown suitable for $GITHUB_STEP_SUMMARY
#
# This script never fails the caller -- on any error it outputs a minimal
# fallback message and exits 0.

set -uo pipefail

STATUS_OK="✅"
STATUS_FLAGGED="🔴"
ICON_PASS="✅"
ICON_FAIL="❌"

# ---------------------------------------------------------------------------
# Derive dashboard base URL from API URL
# ---------------------------------------------------------------------------
# Maps API endpoint to the corresponding dashboard:
#   api.garnet.ai         → dashboard.garnet.ai
#   dev-api.garnet.ai     → dev-dashboard.garnet.ai
#   staging-api.garnet.ai → staging-dashboard.garnet.ai
API_HOST="${GARNET_API_URL:-${API_URL:-https://api.garnet.ai}}"
DASHBOARD_BASE_URL=$(echo "$API_HOST" | sed 's|api\.garnet\.ai|dashboard.garnet.ai|')

# ---------------------------------------------------------------------------
# Read profile from file argument or stdin
# ---------------------------------------------------------------------------
PROFILE_JSON=""

if [ $# -ge 1 ] && [ -f "$1" ]; then
    PROFILE_JSON=$(cat "$1")
elif [ ! -t 0 ]; then
    PROFILE_JSON=$(cat)
else
    echo "### Garnet · Runtime Report"
    echo ""
    echo "> Profile data unavailable."
    exit 0
fi

# Validate that we have parseable JSON
if ! echo "$PROFILE_JSON" | jq empty 2>/dev/null; then
    echo "### Garnet · Runtime Report"
    echo ""
    echo "> Profile data could not be parsed."
    exit 0
fi

# ---------------------------------------------------------------------------
# Extract top-level fields via a single jq call for efficiency
# ---------------------------------------------------------------------------
eval "$(echo "$PROFILE_JSON" | jq -r '
    @sh "RUN_ID=\(.run.run_id // "unknown")",
    @sh "TOTAL_DOMAINS=\(.telemetry.unique_domains // 0)",
    @sh "FLAGGED_DOMAINS=\(.egress.flagged_domains // 0)",
    @sh "TOTAL_CONNECTIONS=\(.telemetry.total_connections // 0)",
    @sh "DOMAIN_COUNT=\(.egress.unique_domains | length)"
' 2>/dev/null)" || {
    echo "### Garnet · Runtime Report"
    echo ""
    echo "> Profile data could not be extracted."
    exit 0
}

# ---------------------------------------------------------------------------
# Render header
# ---------------------------------------------------------------------------
echo "### Garnet · Runtime Report"
echo ""

# ---------------------------------------------------------------------------
# Render egress summary table
# ---------------------------------------------------------------------------
echo "**EGRESS SUMMARY**"
echo ""

if [ "${DOMAIN_COUNT:-0}" -gt 0 ] 2>/dev/null; then
    echo "| Destination | Lineage | Status |"
    echo "|---|---|---|"

    # Build all egress rows in a single jq call.
    # Pass emoji characters as jq arguments to avoid encoding issues.
    echo "$PROFILE_JSON" | jq -r \
        --arg ok "$STATUS_OK" \
        --arg flagged "$STATUS_FLAGGED" '
        .egress.unique_domains[] |
        "| " + .domain + " | " +
        (.ancestry | join(" → ")) + " | " +
        (if .status == "ok" then $ok else $flagged end) +
        " |"
    ' 2>/dev/null
else
    echo "> No egress domains observed."
fi

echo ""

# ---------------------------------------------------------------------------
# Render assertions table
# ---------------------------------------------------------------------------
echo "**ASSERTIONS**"
echo ""

ASSERTION_COUNT=$(echo "$PROFILE_JSON" | jq -r '.assertions | length' 2>/dev/null)

if [ "${ASSERTION_COUNT:-0}" -gt 0 ] 2>/dev/null; then
    echo "| | Assertion | Result |"
    echo "|---|---|---|"

    # Build all assertion rows in a single jq call
    echo "$PROFILE_JSON" | jq -r \
        --arg pass "$ICON_PASS" \
        --arg fail "$ICON_FAIL" '
        .assertions[] |
        "| " +
        (if .result == "PASS" then $pass else $fail end) +
        " | " + .id + " | " + .result + " |"
    ' 2>/dev/null

    echo ""

    # Render assertion details as blockquotes (only for non-PASS)
    echo "$PROFILE_JSON" | jq -r '
        .assertions[] |
        select(.result != "PASS") |
        select(.details != null and .details != "") |
        "> " + .details
    ' 2>/dev/null
else
    echo "> No assertions evaluated."
fi

echo ""

# ---------------------------------------------------------------------------
# Render telemetry summary line
# ---------------------------------------------------------------------------
echo "**${TOTAL_DOMAINS}** unique domains · **${FLAGGED_DOMAINS}** flagged · **${TOTAL_CONNECTIONS}** connections · Run #${RUN_ID}"
echo ""

# ---------------------------------------------------------------------------
# Render footer with report permalink
# ---------------------------------------------------------------------------
echo "---"
echo "Powered by [Garnet](https://garnet.ai) · [View full report ↗](${DASHBOARD_BASE_URL}/dashboard/runs/${RUN_ID})"
