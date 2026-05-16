/**
 * User-agent → human-readable device label. Used by the Profile page
 * 'Active sessions' table so users see 'Chrome on macOS' instead of
 * the raw 100+ character UA string. Pure regex; no external dep.
 *
 * Coverage: Chrome / Firefox / Safari / Edge / Opera / Brave (Brave UA
 * spoofs as Chrome and is intentionally not separately detectable
 * without a Brave-only API call). Mobile detection sniffs the iPhone /
 * iPad / Android / Windows Phone tokens.
 */

export interface ParsedDevice {
  browser: string;
  os: string;
  /** Combined "Browser on OS" label for display. */
  label: string;
}

const UNKNOWN: ParsedDevice = { browser: 'Browser', os: 'Unknown', label: 'Unknown device' };

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\//.test(ua) || / Opera\//.test(ua)) return 'Opera';
  if (/Chrome\//.test(ua) && !/Chromium\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua) && !/Chromium\//.test(ua)) return 'Safari';
  if (/Chromium\//.test(ua)) return 'Chromium';
  return 'Browser';
}

function detectOs(ua: string): string {
  if (/iPad/.test(ua)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) {
    const m = ua.match(/Android (\d+(?:\.\d+)?)/);
    return m ? `Android ${m[1]}` : 'Android';
  }
  if (/Windows Phone/.test(ua)) return 'Windows Phone';
  if (/Windows NT 10/.test(ua)) return 'Windows';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua) || /Macintosh/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  return 'Unknown';
}

export function parseDeviceName(userAgent: string | null | undefined): ParsedDevice {
  if (!userAgent) return UNKNOWN;
  const browser = detectBrowser(userAgent);
  const os = detectOs(userAgent);
  return { browser, os, label: `${browser} on ${os}` };
}
