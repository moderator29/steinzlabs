import { NextRequest, NextResponse } from 'next/server';

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

  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Missing security token' },
      { status: 400 },
    );
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // Fail open if secret key is not configured (dev environments)
  if (!secretKey) {
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
