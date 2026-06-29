#!/usr/bin/env python3
"""
push_to_github.py
Pushes all PhantomBrowser project files to GitHub via the REST API.

Usage:
    python3 push_to_github.py
"""

import urllib.request
import urllib.error
import json
import base64
import os
import time
import sys

TOKEN = input("Enter your GitHub token: ").strip()
REPO  = "segz7448/PhantomBrowser"
BASE  = os.path.dirname(os.path.abspath(__file__))

HEADERS = {
    "Authorization": f"token {TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "User-Agent": "PhantomBrowser-pusher/1.0",
}


def api_request(path: str, method: str = "GET", data=None):
    url = f"https://api.github.com/repos/{REPO}/contents/{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r), None
    except urllib.error.HTTPError as e:
        return None, e.read().decode()


def get_sha(path: str):
    resp, _ = api_request(path)
    if resp and isinstance(resp, dict) and "sha" in resp:
        return resp["sha"]
    return None


def push_file(rel_path: str, content_bytes: bytes) -> bool:
    encoded = base64.b64encode(content_bytes).decode()
    sha = get_sha(rel_path)
    payload = {
        "message": f"chore: add/update {rel_path}",
        "content": encoded,
    }
    if sha:
        payload["sha"] = sha
    _, err = api_request(rel_path, method="PUT", data=payload)
    if err:
        print(f"  ✗ {rel_path}: {err[:160]}")
        return False
    print(f"  ✓ {rel_path}")
    time.sleep(0.35)
    return True


SKIP_DIRS  = {"node_modules", "__pycache__", ".gradle", "build", ".idea", ".expo", ".metro"}
SKIP_EXTS  = {".pyc", ".class", ".iml"}
SKIP_FILES = {"debug.keystore", "release.keystore", "local.properties"}


def walk_and_push(local_dir: str, remote_prefix: str = ""):
    ok_count = 0
    fail_count = 0
    for root, dirs, files in os.walk(local_dir):
        rel_root = os.path.relpath(root, local_dir)
        dirs[:] = sorted(
            d for d in dirs
            if d not in SKIP_DIRS and not (d == ".git" and rel_root == ".")
        )
        for fname in sorted(files):
            if any(fname.endswith(e) for e in SKIP_EXTS):
                continue
            if fname in SKIP_FILES:
                print(f"  ⚠ skipped (secret): {fname}")
                continue
            local_path = os.path.join(root, fname)
            rel = os.path.relpath(local_path, local_dir).replace("\\", "/")
            remote_path = f"{remote_prefix}/{rel}" if remote_prefix else rel
            try:
                with open(local_path, "rb") as f:
                    data = f.read()
            except OSError as e:
                print(f"  ✗ could not read {rel}: {e}")
                fail_count += 1
                continue
            if push_file(remote_path, data):
                ok_count += 1
            else:
                fail_count += 1
    return ok_count, fail_count


if __name__ == "__main__":
    if not TOKEN:
        print("Error: token is required.")
        sys.exit(1)

    print(f"\nPushing PhantomBrowser → https://github.com/{REPO}\n")
    pushed, failed = walk_and_push(BASE)
    print(f"\n{'─'*50}")
    print(f"  ✓ {pushed} files pushed")
    if failed:
        print(f"  ✗ {failed} files failed")
    print(f"\nNext step — trigger the build:")
    print(f"  python3 trigger_build.py")
    print(f"  or visit: https://github.com/{REPO}/actions")
