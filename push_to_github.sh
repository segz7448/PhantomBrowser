#!/bin/bash
# ─────────────────────────────────────────────────────────────
# push_to_github.sh
# Pushes PhantomBrowser to GitHub using git commands.
# Usage: bash push_to_github.sh
# ─────────────────────────────────────────────────────────────

REPO="segz7448/PhantomBrowser"
BRANCH="main"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   PhantomBrowser → GitHub Pusher     ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── Ask for token ──────────────────────────────────────────
read -rsp "Enter your GitHub token: " TOKEN
echo ""

if [ -z "$TOKEN" ]; then
  echo "✗ Token is required."
  exit 1
fi

cd "$DIR" || exit 1

# ── Check git is installed ─────────────────────────────────
if ! command -v git &>/dev/null; then
  echo "✗ git is not installed. Install it with: pkg install git"
  exit 1
fi

# ── Remove any existing git state and start fresh ─────────
echo ""
echo "► Initialising fresh git repo..."
rm -rf .git
git init
git checkout -b "$BRANCH"

# ── Set git identity (required for commit) ────────────────
git config user.email "phantom@build.local"
git config user.name "PhantomBrowser"

# ── Stage everything ──────────────────────────────────────
echo "► Staging all files..."
git add .

# ── Commit ────────────────────────────────────────────────
echo "► Committing..."
git commit -m "Initial commit: PhantomBrowser v1.0.0"

# ── Set remote with token embedded in URL ────────────────
REMOTE="https://${TOKEN}@github.com/${REPO}.git"
git remote add origin "$REMOTE"

# ── Push ─────────────────────────────────────────────────
echo "► Pushing to https://github.com/${REPO}..."
echo ""

if git push -u origin "$BRANCH" --force; then
  echo ""
  echo "✓ Push complete!"
  echo "  https://github.com/${REPO}"
  echo ""
  echo "► Now trigger the build:"
  echo "  bash trigger_build.sh"
  echo "  or go to: https://github.com/${REPO}/actions"
else
  echo ""
  echo "✗ Push failed. Check your token has 'repo' and 'workflow' scopes."
  echo "  Generate one at: https://github.com/settings/tokens"
  exit 1
fi

# ── Clean token from git config ───────────────────────────
git remote set-url origin "https://github.com/${REPO}.git"
echo ""
echo "► Token removed from git config."
