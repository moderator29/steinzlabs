/**
 * Returns the base URL of the current deployment.
 * Priority:
 *   1. NEXT_PUBLIC_SITE_URL  — set this manually in Vercel env vars
 *   2. VERCEL_URL            — auto-set by Vercel (no https prefix, so we add it)
 *   3. Fallback to localhost for local dev
 */
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}
