import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * CSRF token helpers. Issues a signed token bound to the user's
 * session and validates the same token on state-changing requests
 * (POST / PUT / PATCH / DELETE). Uses the double-submit-cookie
 * pattern: the server issues a cookie + a matching token; the
 * client must send the token back via the X-CSRF-Token header,
 * which a same-origin script can do but a cross-origin attacker
 * cannot (no access to the cookie).
 *
 * Token shape: <random-id>.<hmac-sha256(secret, sessionId|random-id)>
 * — random-id prevents replay across sessions; HMAC prevents forgery
 * without the server-side secret. Audit B.19 infra P1 + audit
 * findings on missing CSRF on POST endpoints.
 */

const CSRF_SECRET_ENV = 'CSRF_SECRET';

function getSecret(): string {
  const secret = (process.env[CSRF_SECRET_ENV] || '').trim();
  if (!secret) {
    // Fail loud — running without CSRF_SECRET means every issued
    // token is forgeable. Better to throw at boot than to silently
    // ship an unsigned token to production.
    throw new Error(`${CSRF_SECRET_ENV} env var is required for CSRF token issuance`);
  }
  return secret;
}

export function issueCsrfToken(sessionId: string): string {
  const rid = randomBytes(16).toString('hex');
  const sig = createHmac('sha256', getSecret()).update(`${sessionId}|${rid}`).digest('hex');
  return `${rid}.${sig}`;
}

export function verifyCsrfToken(token: string | null | undefined, sessionId: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [rid, sigHex] = parts;
  if (!/^[0-9a-f]+$/i.test(rid) || !/^[0-9a-f]+$/i.test(sigHex)) return false;
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return false;
  }
  const expectedHex = createHmac('sha256', secret).update(`${sessionId}|${rid}`).digest('hex');
  const a = Buffer.from(sigHex, 'hex');
  const b = Buffer.from(expectedHex, 'hex');
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Pull the CSRF token off an incoming request. Reads X-CSRF-Token
 * first (preferred — same-origin script setting it explicitly) and
 * falls back to a form field named '_csrf' for legacy form posts.
 */
export function readCsrfFromRequest(request: Request, formBody?: FormData | null): string | null {
  const header = request.headers.get('x-csrf-token');
  if (header) return header;
  if (formBody) {
    const f = formBody.get('_csrf');
    if (typeof f === 'string') return f;
  }
  return null;
}
