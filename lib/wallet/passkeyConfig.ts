import 'server-only';

/**
 * WebAuthn relying-party configuration. RP ID must be the registrable
 * domain (no scheme, no port) — Vercel preview deployments register
 * under naka-labs.vercel.app while prod is nakalabs.com. We pin both
 * via env so QA on preview branches doesn't need a separate auth flow.
 */

export function getRpConfig() {
  const rpName = 'Naka Labs';
  // Strip scheme + port; WebAuthn rejects non-bare hosts.
  const explicit = process.env.WEBAUTHN_RP_ID;
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nakalabs.com';
  const url = (() => { try { return new URL(origin); } catch { return new URL('https://nakalabs.com'); } })();
  const rpID = explicit && explicit.length > 0 ? explicit : url.hostname;
  return { rpName, rpID, expectedOrigin: url.origin };
}

export function isPasskeyFeatureEnabled(flagRow: { enabled?: boolean } | null | undefined): boolean {
  return Boolean(flagRow?.enabled);
}
