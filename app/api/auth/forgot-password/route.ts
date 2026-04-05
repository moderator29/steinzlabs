import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendPasswordResetEmail } from '@/lib/email';

function generateResetToken(userId: string, email: string): string {
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'steinz-reset-secret';
  const hour = Math.floor(Date.now() / (1000 * 60 * 60));
  const data = `${userId}:${email}:${secret}:${hour}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return Buffer.from(`${userId.slice(0, 8)}${hex}reset`).toString('base64url');
}

export function validateResetToken(userId: string, email: string, token: string): boolean {
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'steinz-reset-secret';
  const currentHour = Math.floor(Date.now() / (1000 * 60 * 60));

  for (let offset = 0; offset <= 1; offset++) {
    const hour = currentHour - offset;
    const data = `${userId}:${email}:${secret}:${hour}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    const expected = Buffer.from(`${userId.slice(0, 8)}${hex}reset`).toString('base64url');
    if (token === expected) return true;
  }
  return false;
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const admin = getSupabaseAdmin();

    const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = usersData?.users?.find(
      (u: any) => u.email?.toLowerCase() === cleanEmail
    );

    if (!user) {
      return NextResponse.json({ success: true });
    }

    const token = generateResetToken(user.id, cleanEmail);
    const resetUrl = `https://steinzlabs.com/reset-password?token=${token}&uid=${user.id}`;

    const firstName = user.user_metadata?.first_name || 'there';
    const emailSent = await sendPasswordResetEmail(cleanEmail, resetUrl, firstName);

    if (!emailSent) {
      console.error('[ForgotPassword] Failed to send reset email to', cleanEmail);
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 });
    }

    console.log(`[ForgotPassword] Reset email sent to ${cleanEmail}`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[ForgotPassword] error:', err.message);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
