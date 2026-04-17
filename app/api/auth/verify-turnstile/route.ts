import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ success: false, error: 'No token provided' }, { status: 400 });
  }

  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    return NextResponse.json({ success: true, bypass: true });
  }

  if (token === 'dev-bypass') {
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({ success: true, bypass: true });
    }
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 403 });
  }

  const formData = new FormData();
  formData.append('secret', secretKey);
  formData.append('response', token);
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    formData.append('remoteip', forwardedFor.split(',')[0].trim());
  }

  const verifyResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });

  const data = await verifyResponse.json() as { success: boolean; 'error-codes'?: string[] };

  if (!data.success) {
    return NextResponse.json({ success: false, error: 'Verification failed', errors: data['error-codes'] }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
