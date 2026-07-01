package com.phantombrowser.modules;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;

import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsCallback;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import java.util.Arrays;
import java.util.List;

/**
 * CustomTabsModule
 *
 * Launches URLs in Chrome Custom Tabs — the real Chromium engine running
 * inside the app's process. Sites see a genuine Chrome browser fingerprint:
 * correct User-Agent, Accept headers, WebGL renderer, canvas signature,
 * navigator.webdriver = false, window.chrome present, etc.
 *
 * Trade-off vs WebView mode:
 *   ✓ Real Chrome fingerprint — Facebook, Instagram, banking sites all work
 *   ✓ Chrome's full cookie store (user already logged in)
 *   ✓ Chrome's certificate pinning, Safe Browsing, content blocking
 *   ✗ Cannot route through our SOCKS5 proxy — Custom Tabs ignores System
 *     proxy settings and always uses the device's direct network connection.
 *     For proxy-protected browsing, use WebView mode (the default).
 *
 * The JS layer exposes both modes; the user chooses per-tab which to use.
 */
public class CustomTabsModule extends ReactContextBaseJavaModule {

    // Package names to try in order of preference.
    // Chrome stable → Chrome beta → Chrome dev → Bromite (privacy-focused Chromium fork)
    private static final List<String> CHROMIUM_PACKAGES = Arrays.asList(
        "com.android.chrome",
        "com.chrome.beta",
        "com.chrome.dev",
        "com.chrome.canary",
        "org.bromite.bromite",
        "com.kiwibrowser.browser"
    );

    private CustomTabsClient customTabsClient;
    private CustomTabsSession customTabsSession;
    private CustomTabsServiceConnection serviceConnection;
    private String boundPackage;

    public CustomTabsModule(ReactApplicationContext context) {
        super(context);
        warmUp(context);
    }

    @Override
    public String getName() { return "CustomTabsModule"; }

    /**
     * Pre-warm the Custom Tabs service so the first launch is instant.
     * Called from the constructor — happens in the background before the
     * user ever taps "Open in Chrome shell".
     */
    private void warmUp(ReactApplicationContext context) {
        String pkg = getChromiumPackage(context);
        if (pkg == null) return;
        boundPackage = pkg;
        serviceConnection = new CustomTabsServiceConnection() {
            @Override
            public void onCustomTabsServiceConnected(ComponentName name, CustomTabsClient client) {
                customTabsClient = client;
                customTabsClient.warmup(0L);
                customTabsSession = customTabsClient.newSession(new CustomTabsCallback() {});
                // Pre-fetch the most likely starting page for instant first load
                if (customTabsSession != null) {
                    customTabsSession.mayLaunchUrl(Uri.parse("https://duckduckgo.com"), null, null);
                }
            }
            @Override
            public void onServiceDisconnected(ComponentName name) {
                customTabsClient = null;
                customTabsSession = null;
            }
        };
        CustomTabsClient.bindCustomTabsService(context, pkg, serviceConnection);
    }

    /**
     * Returns the best available Chromium package installed on the device,
     * or null if none is installed.
     */
    @ReactMethod
    public void getAvailableEngine(Promise promise) {
        String pkg = getChromiumPackage(getReactApplicationContext());
        WritableMap result = Arguments.createMap();
        result.putBoolean("available", pkg != null);
        result.putString("package", pkg != null ? pkg : "");
        result.putString("name", friendlyName(pkg));
        promise.resolve(result);
    }

    /**
     * Opens a URL in Custom Tabs.
     *
     * @param url         The URL to open.
     * @param toolbarColor Hex color string (e.g. "#1a73e8") for the top toolbar.
     *                     Pass null for the default.
     */
    @ReactMethod
    public void openUrl(String url, String toolbarColor, Promise promise) {
        try {
            Context ctx = getReactApplicationContext();
            String pkg = getChromiumPackage(ctx);

            if (pkg == null) {
                promise.reject("NO_CHROME", "No Chromium-based browser found on this device");
                return;
            }

            int color = Color.parseColor(toolbarColor != null ? toolbarColor : "#f1f3f4");

            CustomTabsIntent.Builder builder = new CustomTabsIntent.Builder(customTabsSession);
            builder.setDefaultColorSchemeParams(
                new CustomTabColorSchemeParams.Builder()
                    .setToolbarColor(color)
                    .setNavigationBarColor(color)
                    .build()
            );
            builder.setShowTitle(true);
            builder.setShareState(CustomTabsIntent.SHARE_STATE_ON);
            builder.setBookmarksButtonEnabled(true);
            builder.setDownloadButtonEnabled(true);
            builder.setColorScheme(CustomTabsIntent.COLOR_SCHEME_SYSTEM);
            // Animate in from the right (like Chrome does for links)
            builder.setStartAnimations(ctx, android.R.anim.slide_in_left, android.R.anim.slide_out_right);
            builder.setExitAnimations(ctx, android.R.anim.slide_in_left, android.R.anim.slide_out_right);

            CustomTabsIntent intent = builder.build();
            // Force the specific Chromium package instead of letting Android pick
            intent.intent.setPackage(pkg);
            intent.intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            ctx.startActivity(intent.intent.setData(Uri.parse(url)));
            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("OPEN_FAILED", e.getMessage());
        }
    }

    /**
     * Pre-fetches a URL so it loads instantly when opened.
     * Call this when the user hovers over or starts typing a URL.
     */
    @ReactMethod
    public void prefetch(String url) {
        if (customTabsSession != null) {
            try {
                customTabsSession.mayLaunchUrl(Uri.parse(url), null, null);
            } catch (Exception ignored) {}
        }
    }

    private String getChromiumPackage(Context ctx) {
        PackageManager pm = ctx.getPackageManager();
        for (String pkg : CHROMIUM_PACKAGES) {
            try {
                pm.getPackageInfo(pkg, 0);
                return pkg;
            } catch (PackageManager.NameNotFoundException ignored) {}
        }
        return null;
    }

    private String friendlyName(String pkg) {
        if (pkg == null) return "None";
        switch (pkg) {
            case "com.android.chrome": return "Google Chrome";
            case "com.chrome.beta": return "Chrome Beta";
            case "com.chrome.dev": return "Chrome Dev";
            case "com.chrome.canary": return "Chrome Canary";
            case "org.bromite.bromite": return "Bromite";
            case "com.kiwibrowser.browser": return "Kiwi Browser";
            default: return pkg;
        }
    }
}
