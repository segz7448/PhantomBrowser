import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import {CRASH_REPORT_CONFIG} from './crashReportConfig.local';

const SENT_LOG_KEY = 'phantom_crash_reports_sent';
const MAX_LOG_ENTRIES = 50;
// Same crash signature won't be re-reported more than once within this window,
// so a crash loop on app start doesn't flood the repo with duplicate issues.
const DEDUPE_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

interface SentEntry {
  hash: string;
  at: number;
}

// Cheap string hash (FNV-1a) — good enough for dedupe, no native crypto needed.
function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16);
}

// Strips things that shouldn't leave the device: URLs (proxy/browsing
// activity), IPs, file paths with usernames, and anything that looks like a
// token/key. This is a best-effort scrub, not a guarantee — see note in
// reportCrash() about what NOT to log in error messages in the first place.
function redact(text: string): string {
  return text
    .replace(/https?:\/\/[^\s)'"]+/g, '[redacted-url]')
    .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '[redacted-ip]')
    .replace(/\/(data|storage)\/[^\s)'"]+/g, '[redacted-path]')
    .replace(/\b[A-Za-z0-9_-]{30,}\b/g, '[redacted-token]');
}

async function getSentLog(): Promise<SentEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(SENT_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function markSent(hash: string) {
  const log = await getSentLog();
  const now = Date.now();
  const next = [...log.filter(e => now - e.at < DEDUPE_WINDOW_MS), {hash, at: now}].slice(-MAX_LOG_ENTRIES);
  await AsyncStorage.setItem(SENT_LOG_KEY, JSON.stringify(next)).catch(() => {});
}

async function wasRecentlySent(hash: string): Promise<boolean> {
  const log = await getSentLog();
  const now = Date.now();
  return log.some(e => e.hash === hash && now - e.at < DEDUPE_WINDOW_MS);
}

export interface CrashPayload {
  message: string;
  stack?: string;
  componentStack?: string;
  isFatal?: boolean;
}

export type ReportStatus = 'sent' | 'skipped' | 'failed';

let inFlight = false;

// Fires a GitHub issue for an uncaught crash. Safe to call from anywhere —
// fails silently (network errors, missing token, etc. never throw back into
// the crash handler, since that would defeat the point of catching the crash
// in the first place). Returns a status so the UI can show what happened.
export async function reportCrash(payload: CrashPayload): Promise<ReportStatus> {
  if (!CRASH_REPORT_CONFIG.enabled) return 'skipped';
  if (!CRASH_REPORT_CONFIG.token || CRASH_REPORT_CONFIG.token.startsWith('PASTE_')) return 'skipped';
  if (inFlight) return 'skipped';

  const signature = `${payload.message}|${(payload.stack || '').slice(0, 200)}`;
  const hash = hashString(signature);

  if (await wasRecentlySent(hash)) return 'skipped';

  inFlight = true;
  try {
    const body = [
      `**Auto-reported crash** (signature \`${hash}\`)`,
      '',
      `- Fatal: ${payload.isFatal ? 'yes' : 'no'}`,
      `- Platform: ${Platform.OS} ${Platform.Version}`,
      '',
      '**Message**',
      '```',
      redact(payload.message).slice(0, 2000),
      '```',
      payload.stack ? ['**Stack**', '```', redact(payload.stack).slice(0, 4000), '```'].join('\n') : '',
      payload.componentStack
        ? ['**Component stack**', '```', redact(payload.componentStack).slice(0, 2000), '```'].join('\n')
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const res = await fetch(
      `https://api.github.com/repos/${CRASH_REPORT_CONFIG.owner}/${CRASH_REPORT_CONFIG.repo}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CRASH_REPORT_CONFIG.token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `[auto-crash] ${payload.message.slice(0, 80)}`,
          body,
          labels: ['auto-crash-report'],
        }),
      },
    );

    if (res.ok) {
      await markSent(hash);
      return 'sent';
    }
    return 'failed';
  } catch {
    // Deliberately swallowed — see function doc comment.
    return 'failed';
  } finally {
    inFlight = false;
  }
}
