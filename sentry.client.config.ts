import * as Sentry from '@sentry/nextjs';

/**
 * Per-route trace sampling — the flat 0.1 prod rate was costing 40-60%
 * of the Sentry bill on hot polling routes (whale-activity, market
 * stats, price cache) that we don't need fine-grained traces for.
 *
 * Strategy:
 *   • critical user flows                          1.0 / 0.5
 *     (trade execute, wallet auth, security gate)
 *   • interesting business flows                   0.2
 *     (proof view, VTX chat, sniper enrich)
 *   • noisy background polls + health checks      0.01 / 0
 *   • everything else                              0.1 (parent rate)
 */
function tracesSampler(context: { name?: string; location?: { pathname?: string } }): number {
  const path = context.location?.pathname ?? context.name ?? '';
  // Drop health + ping noise outright.
  if (path.startsWith('/api/health') || path === '/api/rum' || path.startsWith('/api/cron/')) {
    return 0.01;
  }
  // Trade execution is gold.
  if (
    path.startsWith('/api/market/trade/') ||
    path.startsWith('/api/sniper/execute') ||
    path.startsWith('/api/copy-trading/') ||
    path.startsWith('/api/auth/')
  ) {
    return process.env.NODE_ENV === 'production' ? 0.5 : 1.0;
  }
  // Interesting but not critical.
  if (
    path.startsWith('/api/vtx-ai') ||
    path.startsWith('/api/bubble-map') ||
    path.startsWith('/api/security/') ||
    path.startsWith('/api/engagement')
  ) {
    return process.env.NODE_ENV === 'production' ? 0.2 : 1.0;
  }
  // High-volume polling — keep sampling alive but minimal.
  if (
    path.startsWith('/api/portfolio') ||
    path.startsWith('/api/market/stats') ||
    path.startsWith('/api/whale/activity')
  ) {
    return process.env.NODE_ENV === 'production' ? 0.02 : 0.5;
  }
  return process.env.NODE_ENV === 'production' ? 0.1 : 1.0;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampler,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],
  beforeSend(event) {
    // PII scrubbing — audit found that only cookies were redacted.
    // Add: Authorization header (Bearer JWT), email + access_token in
    // user_metadata, encrypted_private_key fields anywhere they appear,
    // and any value pattern that looks like a JWT.
    if (event.request?.cookies) {
      event.request.cookies = {};
    }
    if (event.request?.headers) {
      const h = event.request.headers as Record<string, string>;
      for (const k of Object.keys(h)) {
        const lc = k.toLowerCase();
        if (lc === 'authorization' || lc === 'cookie' || lc === 'x-cron-secret') {
          h[k] = '[redacted]';
        }
      }
    }
    // Strip JWT, wallet, tx-hash, and email patterns from extra/contexts/url
    const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
    const EVM_ADDR_RE = /0x[a-fA-F0-9]{40}\b/g;
    const TX_HASH_RE = /0x[a-fA-F0-9]{64}\b/g;
    const SOL_ADDR_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
    const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const REDACT_KEYS = new Set([
      'email', 'access_token', 'refresh_token', 'jwt', 'token', 'session_token',
      'private_key', 'encrypted_private_key', 'seed', 'mnemonic',
      'address', 'wallet_address', 'tx', 'tx_hash', 'transaction_hash',
    ]);
    const scrubString = (s: string): string =>
      s
        .replace(JWT_RE, '[redacted-jwt]')
        .replace(TX_HASH_RE, '[redacted-tx]')
        .replace(EVM_ADDR_RE, '[redacted-addr]')
        .replace(EMAIL_RE, '[redacted-email]')
        .replace(SOL_ADDR_RE, (m) =>
          // Solana addrs collide with random base58 — only redact when
          // the surrounding length looks address-shaped (32-44 chars).
          m.length >= 32 && m.length <= 44 ? '[redacted-addr]' : m,
        );
    const scrub = (obj: unknown): unknown => {
      if (!obj || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(scrub);
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (REDACT_KEYS.has(k.toLowerCase())) { out[k] = '[redacted]'; continue; }
        if (typeof v === 'string') { out[k] = scrubString(v); continue; }
        out[k] = scrub(v);
      }
      return out;
    };
    if (event.extra) event.extra = scrub(event.extra) as typeof event.extra;
    if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;
    if (event.request?.url) event.request.url = scrubString(event.request.url);
    if (event.message) event.message = scrubString(event.message);
    if (event.breadcrumbs) {
      for (const b of event.breadcrumbs) {
        if (b.message) b.message = scrubString(b.message);
        if (b.data) b.data = scrub(b.data) as typeof b.data;
      }
    }
    if (event.user) {
      // Keep id for correlation; drop email + ip_address.
      event.user = { id: event.user.id };
    }
    return event;
  },
});
