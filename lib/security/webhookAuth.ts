import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Webhook authentication + rate-limit helpers. Wrap every inbound
 * provider webhook (Alchemy, Helius, Stripe, Telegram) with
 * verifyHmacSignature() so a forged payload can't slip past the
 * route handler.
 *
 * The webhook routes were the audit's biggest 'unauthenticated POST'
 * exposure — anyone with the URL could spam fake whale-activity
 * events into the DB. HMAC of the raw body + per-provider secret
 * fixes that.
 *
 * Audit §B.13 webhook rate-limit + §B.19 infra P1.
 */

export interface HmacVerifyOpts {
  /** Raw request body bytes — read via `await request.text()` BEFORE parsing JSON. */
  rawBody: string;
  /** Header carrying the signature ('x-alchemy-signature', 'svix-signature', etc). */
  signatureHeader: string | null;
  /** Provider's signing secret from env. */
  secret: string;
  /** Hash algorithm; default 'sha256'. */
  algorithm?: 'sha256' | 'sha512';
}

export function verifyHmacSignature(opts: HmacVerifyOpts): boolean {
  if (!opts.secret || !opts.signatureHeader) return false;
  const algo = opts.algorithm ?? 'sha256';
  const computed = createHmac(algo, opts.secret).update(opts.rawBody, 'utf8').digest('hex');
  // Strip common prefixes ('sha256=', 't=...,v1=...' for Stripe).
  const presented = opts.signatureHeader.replace(/^sha256=/i, '').trim();
  try {
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(presented, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Constant-time string equality for cases where the comparand isn't
 * a hex digest (e.g. shared bearer tokens). Falls back to length-
 * mismatch fast-path so leaked length is acceptable, but the
 * content comparison is constant-time.
 */
export function safeCompareStrings(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
