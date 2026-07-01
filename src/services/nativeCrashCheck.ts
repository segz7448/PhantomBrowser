import {NativeModules} from 'react-native';

const {CrashReportModule} = NativeModules;

/**
 * Reads a crash report left by the native Java uncaught-exception handler
 * (installed in MainApplication.onCreate — see android native source).
 * This catches crashes that kill the process before any JS error handler
 * gets a chance to run, which crashCapture.ts/ErrorBoundary can't reach.
 */
export async function getNativePendingCrash(): Promise<{message: string; stack: string} | null> {
  try {
    if (!CrashReportModule?.getPendingReport) return null;
    const result = await CrashReportModule.getPendingReport();
    if (!result?.report) return null;
    const lines: string[] = result.report.split('\n');
    const message = lines.find((l: string) => l.startsWith('message:'))?.replace('message:', '').trim() || 'Native crash';
    return {message, stack: result.report};
  } catch {
    return null;
  }
}

export function clearNativePendingCrash() {
  try {
    CrashReportModule?.clearPendingReport?.();
  } catch {
    // no-op
  }
}
