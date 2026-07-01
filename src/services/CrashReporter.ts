import {NativeModules, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const {CrashReportModule} = NativeModules;

const JS_CRASH_KEY = 'phantom_pending_js_crash';
const APP_VERSION = '1.0.0';

// Update this if the repo ever moves.
const GITHUB_REPO = 'segz7448/PhantomBrowser';

interface PendingCrash {
  type: 'js' | 'native';
  message: string;
  stack: string;
  timestamp: number;
}

/**
 * Installs RN's built-in global JS error handler. This catches unhandled
 * JS exceptions (the vast majority of React Native crashes) without any
 * third-party crash-reporting SDK. Native/bridge-level crashes that kill
 * the process before JS can react are caught separately by
 * CrashReportModule on the native side (see MainApplication.java).
 */
export function installJSCrashHandler() {
  const defaultHandler = (global as any).ErrorUtils?.getGlobalHandler?.();

  (global as any).ErrorUtils?.setGlobalHandler?.(async (error: Error, isFatal?: boolean) => {
    try {
      const report: PendingCrash = {
        type: 'js',
        message: error?.message ?? String(error),
        stack: error?.stack ?? '(no stack available)',
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(JS_CRASH_KEY, JSON.stringify(report));
    } catch {
      // Don't let crash reporting itself throw.
    }
    if (defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });
}

/**
 * Checks for a crash report left over from the previous run — either a JS
 * crash (stored via AsyncStorage above) or a native crash (stored via the
 * native CrashReportModule, which can capture crashes JS never sees).
 * Call this once on app startup, after the providers mount.
 */
export async function getPendingCrash(): Promise<PendingCrash | null> {
  try {
    const jsRaw = await AsyncStorage.getItem(JS_CRASH_KEY);
    if (jsRaw) {
      return JSON.parse(jsRaw);
    }
  } catch {
    // fall through to native check
  }

  try {
    if (CrashReportModule?.getPendingReport) {
      const result = await CrashReportModule.getPendingReport();
      if (result?.report) {
        return {
          type: 'native',
          message: result.report.split('\n')[1] ?? 'Native crash',
          stack: result.report,
          timestamp: Date.now(),
        };
      }
    }
  } catch {
    // no native crash pending
  }

  return null;
}

export async function clearPendingCrash() {
  try {
    await AsyncStorage.removeItem(JS_CRASH_KEY);
  } catch {}
  try {
    CrashReportModule?.clearPendingReport?.();
  } catch {}
}

/**
 * Builds a GitHub "new issue" URL pre-filled with the crash details.
 * Deliberately does NOT submit anything automatically or use any API
 * token — opening this link still requires the user to review and tap
 * "Submit new issue" themselves. This keeps zero write-access credentials
 * inside the shipped app, which would otherwise be extractable from the APK.
 */
export function buildGithubIssueUrl(crash: PendingCrash): string {
  const title = `[Auto] ${crash.type} crash: ${crash.message}`.slice(0, 120);
  const body = [
    '**Automatically generated crash report**',
    '',
    `- App version: ${APP_VERSION}`,
    `- Platform: ${Platform.OS} ${Platform.Version}`,
    `- Crash type: ${crash.type}`,
    `- Time: ${new Date(crash.timestamp).toISOString()}`,
    '',
    '**Stack trace**',
    '```',
    crash.stack.slice(0, 3000),
    '```',
  ].join('\n');

  return `https://github.com/${GITHUB_REPO}/issues/new?title=${encodeURIComponent(
    title,
  )}&body=${encodeURIComponent(body)}&labels=crash,auto-reported`;
}
