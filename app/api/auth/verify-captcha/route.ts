import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let token: string | undefined;
  let action: string | undefined;

  try {
    const body = await request.json() as { token?: string; action?: string };
    token = body.token;
    action = body.action;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 },
    );
  }

  // Emergency bypass — paired with NEXT_PUBLIC_TURNSTILE_BYPASS on the
  // client. Set BOTH to '1' in Vercel for the duration of a Cloudflare
  // outage or domain-whitelist rotation so users aren't locked out of
  // auth. Unset it the moment Turnstile is back to refuse missing tokens.
  const emergencyBypass = process.env.TURNSTILE_EMERGENCY_BYPASS === '1';

  if (!token) {
    if (emergencyBypass) {
      return NextResponse.json({ success: true, failOpen: true, reason: 'emergency_bypass' });
    }
    return NextResponse.json(
      { success: false, error: 'Missing security token' },
      { status: 400 },
    );
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Fail CLOSED in production: a missing secret is a misconfigured deploy, not a
  // Cloudflare outage, and must never silently wave bot traffic past the login /
  // signup Turnstile gate (this is the LIVE captcha route the client calls).
  // Mirrors the hardened /api/auth/verify-turnstile sibling. Dev/preview keep the
  // fail-open so local iteration isn't blocked; a deliberate outage bypass is
  // still available via TURNSTILE_EMERGENCY_BYPASS above.
  if (!secretKey) {
    if (process.env.NODE_ENV === 'production' && !emergencyBypass) {
      Sentry.captureException(new Error('TURNSTILE_SECRET_KEY missing in production'));
      return NextResponse.json(
        { success: false, error: 'Bot protection misconfigured' },
        { status: 503 },
      );
    }
    return NextResponse.json({ success: true, failOpen: true });
  }

  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown';

  const formData = new FormData();
  formData.append('secret', secretKey);
  formData.append('response', token);
  formData.append('remoteip', ip);

  try {
    const verifyResponse = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(8_000),
    });

    if (!verifyResponse.ok) {
      // Fail open on Cloudflare outage — don't block legit users
      console.warn('[verify-captcha] Cloudflare returned non-OK status, failing open');
      return NextResponse.json({ success: true, failOpen: true });
    }

    const outcome = await verifyResponse.json() as {
      success: boolean;
      'error-codes'?: string[];
      action?: string;
      cdata?: string;
    };

    if (!outcome.success) {
      const errorCodes = outcome['error-codes'] ?? [];
      console.warn('[verify-captcha] Turnstile verification failed', { errorCodes, action });
      return NextResponse.json(
        { success: false, error: 'Security verification failed', codes: errorCodes },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    // Network error / timeout reaching Cloudflare — fail open
    console.warn('[verify-captcha] Cloudflare unreachable, failing open:', err);
    return NextResponse.json({ success: true, failOpen: true });
  }
}
