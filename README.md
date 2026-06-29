# 🛡️ Phantom Browser

A privacy-first Android browser built with React Native. All traffic is tunnelled through a SOCKS5H proxy (proxy-side DNS), WebRTC is blocked, and an integrated ad/tracker blocker runs in the WebView.

## Features

- **SOCKS5H proxy tunnel** — full DNS-over-proxy, no local DNS leaks
- **Ad & tracker blocker** — domain list + DOM injection
- **WebRTC blocker** — prevents IP leaks via browser APIs
- **Canvas fingerprint noise** — minor noise injected to defeat canvas fingerprinting
- **Password vault** — on-device encrypted storage via `react-native-encrypted-storage`
- **Download manager** — track and open downloaded files
- **Incognito WebView** — no cookies, no local history

---

## Project Structure

```
PhantomBrowser/
├── src/
│   ├── App.tsx                     # Root navigation
│   ├── screens/
│   │   ├── BrowserScreen.tsx       # Main WebView browser
│   │   ├── ProxyScreen.tsx         # SOCKS5 config + chain visualiser
│   │   ├── PasswordScreen.tsx      # Encrypted password vault
│   │   ├── DownloadsScreen.tsx     # Download manager
│   │   └── SettingsScreen.tsx      # Privacy toggles
│   └── services/
│       ├── ProxyContext.tsx        # Global proxy state (React Context)
│       └── AdBlocker.ts            # URL + DOM ad blocking
├── android/
│   ├── app/src/main/java/com/phantombrowser/
│   │   ├── proxy/ProxyBridgeModule.java   # Native SOCKS5H HTTP bridge
│   │   ├── modules/PhantomPackage.java    # ReactPackage registration
│   │   ├── MainActivity.java
│   │   └── MainApplication.java
│   └── gradlew                     # Gradle wrapper (must be executable)
├── .github/workflows/build.yml     # GitHub Actions APK build
├── push_to_github.py               # Push all files to GitHub via API
└── trigger_build.py                # Trigger Actions build workflow
```

---

## How to Push to GitHub and Build the APK

### Prerequisites

- A GitHub account and a repository (e.g. `yourusername/PhantomBrowser`)
- A GitHub Personal Access Token with `repo` and `workflow` scopes
  → https://github.com/settings/tokens

### Step 1 — Commit `gradle-wrapper.jar`

The file `android/gradle/wrapper/gradle-wrapper.jar` is a binary required by CI.
Generate it once on your local machine:

```bash
# If you have Gradle installed locally:
cd android
gradle wrapper --gradle-version 8.3
```

Or copy it from any existing React Native 0.73 project's `android/gradle/wrapper/` folder.

### Step 2 — Push all project files

```bash
python3 push_to_github.py
```

Enter your GitHub token and repo (`owner/repo`) when prompted.  
The script skips `node_modules/`, build artifacts, `.pyc` files, and keystores.  
It will push `.github/workflows/build.yml` so GitHub Actions is set up automatically.

### Step 3 — Trigger the build

```bash
python3 trigger_build.py
```

Or go to **Actions → Build PhantomBrowser APK → Run workflow** on GitHub.

### Step 4 — Download the APK

After the workflow succeeds (~5–10 min):

1. Go to your repo on GitHub
2. Click **Actions** → latest workflow run
3. Under **Artifacts**, download `PhantomBrowser-release`
4. Unzip and install `app-release.apk` on your Android device

> **Note:** The APK is signed with a debug keystore by default (generated in CI). To use a release keystore, add your keystore as a GitHub secret and update `build.yml`.

---

## Local Development

```bash
# Install JS dependencies
npm install

# Start Metro bundler
npm start

# Build and install on connected device/emulator
npm run android
```

Requires: Node 18+, JDK 17, Android SDK (API 34), a connected device or emulator.

---

## Architecture: Proxy Bridge

```
WebView (incognito)
    │  HTTP/CONNECT on 127.0.0.1:8118
    ▼
ProxyBridgeModule.java  (native Android service)
    │  SOCKS5H handshake — hostname sent to proxy (no local DNS)
    ▼
SOCKS5 upstream server
    │
    ▼
Internet (exit IP shown in app)
```

The `ProxyBridgeModule` is a fully custom Java SOCKS5H HTTP proxy bridge. It:
- Handles both `CONNECT` (HTTPS) and plain HTTP requests
- Implements RFC 1928 (SOCKS5) + RFC 1929 (username/password auth)
- Runs a cached thread pool — handles concurrent WebView connections
- Verifies connectivity and fetches the exit IP before marking connected

---

## Privacy Notes

| Feature | Status |
|---------|--------|
| DNS leaks | Blocked (SOCKS5H) |
| WebRTC leaks | Blocked (JS injection) |
| Canvas fingerprint | Noise injected |
| Cookies | Disabled (incognito WebView) |
| Local history | Not stored |
| Passwords | AES-encrypted on-device |
| External analytics | None |
| Cloud sync | None — local only |
