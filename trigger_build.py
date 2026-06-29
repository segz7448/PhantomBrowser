#!/usr/bin/env python3
"""
trigger_build.py
Triggers the GitHub Actions build workflow for PhantomBrowser.
Run AFTER push_to_github.py has completed successfully.

Usage:
    python3 trigger_build.py
"""

import urllib.request
import urllib.error
import json
import sys

TOKEN = input("Enter your GitHub token: ").strip()
REPO  = "segz7448/PhantomBrowser"

if not TOKEN:
    print("Error: token is required.")
    sys.exit(1)

url = f"https://api.github.com/repos/{REPO}/actions/workflows/build.yml/dispatches"
payload = json.dumps({"ref": "main"}).encode()
headers = {
    "Authorization": f"token {TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "User-Agent": "PhantomBrowser-trigger/1.0",
}

req = urllib.request.Request(url, data=payload, headers=headers, method="POST")

try:
    with urllib.request.urlopen(req) as r:
        print(f"✓ Build triggered! HTTP {r.status}")
        print(f"  View at: https://github.com/{REPO}/actions")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"✗ Error {e.code}: {body}")
    if e.code == 404:
        print("  → Check that push_to_github.py completed first (workflow file must exist on main).")
    elif e.code == 422:
        print("  → The 'main' branch doesn't exist yet. Run push_to_github.py first.")
    sys.exit(1)
except urllib.error.URLError as e:
    print(f"✗ Network error: {e.reason}")
    sys.exit(1)
