import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { generateVerifyToken } from '@/lib/authTokens';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const userId = url.searchParams.get('uid');

    if (!token || !userId) {
      return NextResponse.redirect('https://steinzlabs.com/login?error=invalid_link');
    }

    const admin = getSupabaseAdmin();

    const { data: { user }, error: userError } = await admin.auth.admin.getUserById(userId);
    if (userError || !user) {
      console.error('[VerifyEmail] User not found:', userId);
      return NextResponse.redirect('https://steinzlabs.com/login?error=user_not_found');
    }

    const expectedToken = generateVerifyToken(userId, user.email || '');
    if (token !== expectedToken) {
      console.error('[VerifyEmail] Token mismatch for user:', userId);
      return NextResponse.redirect('https://steinzlabs.com/login?error=invalid_token');
    }

    if (!user.email_confirmed_at) {
      await admin.auth.admin.updateUserById(userId, { email_confirm: true });
      console.log(`[VerifyEmail] Email confirmed for ${user.email}`);
    }

    return NextResponse.redirect('https://steinzlabs.com/login?confirmed=pending');
  } catch (err: any) {
    console.error('[VerifyEmail] error:', err.message);
    return NextResponse.redirect('https://steinzlabs.com/login?error=verification_failed');
  }
}
