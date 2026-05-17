/**
 * Friendly user-agent parser for the Settings → Active Sessions list.
 * 'Chrome on macOS' is far easier to scan than the raw
 * 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)…' string a user
 * needs to interpret today.
 *
 * Pure regex — keeps the bundle tiny (no ua-parser-js / bowser).
 * Audit §B.6 device-naming P1.
 */

export interface ParsedAgent {
  browser: string;
  os: string;
  device: string; // 'desktop' | 'mobile' | 'tablet' | 'bot'
}

const BROWSER_RULES: Array<[RegExp, string]> = [
  [/edg\/[\d.]+/i, 'Edge'],
  [/opr\/[\d.]+|opera/i, 'Opera'],
  [/chrome\/[\d.]+/i, 'Chrome'],
  [/firefox\/[\d.]+/i, 'Firefox'],
  [/safari\/[\d.]+/i, 'Safari'],
  [/curl\/[\d.]+/i, 'curl'],
  [/postman/i, 'Postman'],
];

const OS_RULES: Array<[RegExp, string]> = [
  [/windows nt 10/i, 'Windows 10/11'],
  [/windows nt/i, 'Windows'],
  [/mac os x ([\d_]+)/i, 'macOS'],
  [/cros /i, 'ChromeOS'],
  [/android/i, 'Android'],
  [/iphone|ipad|ipod/i, 'iOS'],
  [/linux/i, 'Linux'],
];

const BOT_RE = /bot|crawl|spider|preview/i;
const TABLET_RE = /ipad|tablet/i;
const MOBILE_RE = /android|iphone|ipod|mobile/i;

export function parseUserAgent(ua: string | null | undefined): ParsedAgent {
  if (!ua || typeof ua !== 'string') {
    return { browser: 'Unknown', os: 'Unknown', device: 'desktop' };
  }
  const browser = BROWSER_RULES.find(([re]) => re.test(ua))?.[1] ?? 'Unknown';
  const os = OS_RULES.find(([re]) => re.test(ua))?.[1] ?? 'Unknown';
  const device = BOT_RE.test(ua)
    ? 'bot'
    : TABLET_RE.test(ua)
      ? 'tablet'
      : MOBILE_RE.test(ua)
        ? 'mobile'
        : 'desktop';
  return { browser, os, device };
}

/**
 * One-line label suitable for the session row. Combines browser + OS
 * with a sensible fallback so the row always renders something.
 */
export function describeDevice(ua: string | null | undefined): string {
  const p = parseUserAgent(ua);
  if (p.browser === 'Unknown' && p.os === 'Unknown') return 'Unknown device';
  if (p.browser === 'Unknown') return p.os;
  if (p.os === 'Unknown') return p.browser;
  return `${p.browser} on ${p.os}`;
}
