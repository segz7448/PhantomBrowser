// Copy this file to crashReportConfig.local.ts (same folder) and fill in your
// own token. crashReportConfig.local.ts is gitignored — never commit a real
// token here or in that file.

export const CRASH_REPORT_CONFIG = {
  enabled: true,
  token: 'PASTE_YOUR_FINE_GRAINED_TOKEN_HERE', // Issues: write, scoped to this one repo only
  owner: 'yourusername',
  repo: 'PhantomBrowser',
};
