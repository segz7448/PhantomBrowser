import {Platform} from 'react-native';

// Update this if the repo ever moves.
const GITHUB_REPO = 'segz7448/PhantomBrowser';

export interface CrashPayload {
  message: string;
  stack?: string;
  componentStack?: string;
  isFatal?: boolean;
}

export type ReportStatus = 'ready';

// Strips things that shouldn't leave the device: URLs (proxy/browsing
// activity), IPs, file paths with usernames, and anything that looks like a
// token/key. Best-effort, not a guarantee — the user still reviews the body
// before tapping "Submit" on GitHub, since nothing is sent automatically.
function redact(text: string): string {
  return text
    .replace(/https?:\/\/[^\s)'"]+/g, '[redacted-url]')
    .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '[redacted-ip]')
    .replace(/\/(data|storage)\/[^\s)'"]+/g, '[redacted-path]')
    .replace(/\b[A-Za-z0-9_-]{30,}\b/g, '[redacted-token]');
}

/**
 * Builds a GitHub "new issue" URL pre-filled with the (redacted) crash
 * details. Deliberately does NOT submit anything automatically and contains
 * no API token — opening this link still requires the user to review and
 * tap "Submit new issue" themselves. A write-capable token would otherwise
 * need to ship inside the APK, where it's trivially extractable.
 */
export function buildGithubIssueUrl(payload: CrashPayload): string {
  const title = `[Auto] crash: ${payload.message}`.slice(0, 120);
  const body = [
    '**Crash report (review before submitting)**',
    '',
    `- Fatal: ${payload.isFatal ? 'yes' : 'no'}`,
    `- Platform: ${Platform.OS} ${Platform.Version}`,
    `- Time: ${new Date().toISOString()}`,
    '',
    '**Message**',
    '```',
    redact(payload.message).slice(0, 2000),
    '```',
    payload.stack ? ['**Stack**', '```', redact(payload.stack).slice(0, 3000), '```'].join('\n') : '',
    payload.componentStack
      ? ['**Component stack**', '```', redact(payload.componentStack).slice(0, 2000), '```'].join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return `https://github.com/${GITHUB_REPO}/issues/new?title=${encodeURIComponent(
    title,
  )}&body=${encodeURIComponent(body)}&labels=crash,auto-reported`;
}
