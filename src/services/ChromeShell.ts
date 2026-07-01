import {NativeModules, Linking} from 'react-native';

const {CustomTabsModule} = NativeModules;

export interface ChromeEngineInfo {
  available: boolean;
  package: string;
  name: string;
}

/**
 * Returns info about the Chromium engine available on this device
 * (Google Chrome, Chrome Beta, Bromite, Kiwi, etc.)
 */
export async function getChromeEngineInfo(): Promise<ChromeEngineInfo> {
  try {
    if (!CustomTabsModule?.getAvailableEngine) {
      return {available: false, package: '', name: 'None'};
    }
    return await CustomTabsModule.getAvailableEngine();
  } catch {
    return {available: false, package: '', name: 'None'};
  }
}

/**
 * Opens a URL in Chrome Custom Tabs (real Chromium engine).
 *
 * Why this matters: Custom Tabs runs the full Chrome browser inside your
 * app's process. Sites like Facebook, Instagram, and banking apps see a
 * genuine Chrome fingerprint — correct User-Agent, Accept headers, canvas
 * signature, navigator.webdriver = false, window.chrome present — because
 * it literally IS Chrome, not a WebView wrapper.
 *
 * IMPORTANT: Custom Tabs always uses the device's direct network connection.
 * It cannot be routed through your SOCKS5 proxy. Use WebView mode for
 * proxy-protected browsing; use Chrome mode for sites that block WebView.
 *
 * @param url          URL to open
 * @param toolbarColor Hex color for the top toolbar (default: Chrome grey)
 */
export async function openInChrome(url: string, toolbarColor = '#f1f3f4'): Promise<void> {
  try {
    if (!CustomTabsModule?.openUrl) {
      // Fallback: open in whatever browser the user has set as default
      await Linking.openURL(url);
      return;
    }
    await CustomTabsModule.openUrl(url, toolbarColor);
  } catch {
    // Final fallback if Custom Tabs fails entirely
    try { await Linking.openURL(url); } catch {}
  }
}

/**
 * Pre-fetches a URL so it loads instantly when opened in Chrome mode.
 * Call this when the user starts typing or hovers over a link.
 */
export function prefetchInChrome(url: string): void {
  try {
    CustomTabsModule?.prefetch?.(url);
  } catch {}
}
