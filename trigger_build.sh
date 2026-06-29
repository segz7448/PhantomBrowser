#!/bin/bash
# ─────────────────────────────────────────────────────────────
# trigger_build.sh
# Triggers the GitHub Actions APK build workflow.
# Run AFTER push_to_github.sh has completed.
# Usage: bash trigger_build.sh
# ─────────────────────────────────────────────────────────────

REPO="segz7448/PhantomBrowser"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   PhantomBrowser → Trigger Build     ║"
echo "╚══════════════════════════════════════╝"
echo ""

read -rsp "Enter your GitHub token: " TOKEN
echo ""

if [ -z "$TOKEN" ]; then
  echo "✗ Token is required."
  exit 1
fi

echo "► Triggering build workflow..."
echo ""

HTTP_STATUS=$(curl -s -o /tmp/trigger_response.json -w "%{http_code}" \
  -X POST \
  -H "Authorization: token ${TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  -H "User-Agent: PhantomBrowser-trigger/1.0" \
  -d '{"ref":"main"}' \
  "https://api.github.com/repos/${REPO}/actions/workflows/build.yml/dispatches")

if [ "$HTTP_STATUS" = "204" ]; then
  echo "✓ Build triggered successfully!"
  echo "  View at: https://github.com/${REPO}/actions"
else
  echo "✗ Failed — HTTP $HTTP_STATUS"
  cat /tmp/trigger_response.json
  echo ""
  if [ "$HTTP_STATUS" = "404" ]; then
    echo "  → Run push_to_github.sh first so the workflow file exists on main."
  elif [ "$HTTP_STATUS" = "422" ]; then
    echo "  → The main branch doesn't exist yet. Run push_to_github.sh first."
  elif [ "$HTTP_STATUS" = "401" ]; then
    echo "  → Token is invalid or expired."
  fi
  exit 1
fi
