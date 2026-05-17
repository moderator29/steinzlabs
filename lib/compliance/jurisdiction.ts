/**
 * Jurisdiction lookup + risk classification. The middleware reads
 * the Vercel-provided x-vercel-ip-country header on the edge and
 * stamps the request with a risk tier so downstream gates can
 * surface warnings, block trade execution, or require additional
 * disclosure. Audit §5 compliance B.16.
 *
 * NOT legal advice — this is a heuristic safety net so a US-IP user
 * never accidentally clicks 'buy' on a derivative our T&Cs don't
 * permit for them. The owner adds / removes country codes here as
 * counsel updates the policy.
 */

export type JurisdictionRisk =
  | 'allowed'         // green path
  | 'restricted'       // KYC / additional disclosure required
  | 'blocked'         // T&Cs prohibit trade execution from this country
  | 'unknown';        // header missing / VPN — treat as allowed with notice

/**
 * Hard-block list — countries on OFAC sanctions or where our T&Cs
 * explicitly disallow access. Caller surfaces the JurisdictionWarning
 * banner + disables trade execution.
 */
export const BLOCKED_COUNTRIES: ReadonlySet<string> = new Set([
  'IR', 'KP', 'SY', 'CU', 'RU', 'BY',
]);

/**
 * Restricted list — access allowed but trade-exec / derivatives flows
 * surface an extra confirmation modal and the user must acknowledge
 * the local restrictions before signing.
 */
export const RESTRICTED_COUNTRIES: ReadonlySet<string> = new Set([
  'US', 'CA', 'GB', 'SG', 'CN', 'HK',
]);

/**
 * Convert a 2-letter ISO country code (uppercase) into the risk tier.
 * Empty / null / 'XX' returns 'unknown'.
 */
export function classifyJurisdiction(country: string | null | undefined): JurisdictionRisk {
  if (!country || typeof country !== 'string') return 'unknown';
  const code = country.toUpperCase().trim();
  if (code.length !== 2 || code === 'XX') return 'unknown';
  if (BLOCKED_COUNTRIES.has(code)) return 'blocked';
  if (RESTRICTED_COUNTRIES.has(code)) return 'restricted';
  return 'allowed';
}

/**
 * Read the country code from the incoming request headers. Vercel
 * provides x-vercel-ip-country; Cloudflare provides cf-ipcountry. We
 * read both so the same logic works behind either edge.
 */
export function readCountryFromHeaders(headers: Headers): string | null {
  return (
    headers.get('x-vercel-ip-country') ||
    headers.get('cf-ipcountry') ||
    headers.get('x-naka-country') ||
    null
  );
}

/**
 * One-shot helper for API routes — read header + classify in a
 * single call.
 */
export function jurisdictionFromRequest(headers: Headers): {
  country: string | null;
  risk: JurisdictionRisk;
} {
  const country = readCountryFromHeaders(headers);
  return { country, risk: classifyJurisdiction(country) };
}
