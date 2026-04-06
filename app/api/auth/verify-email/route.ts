import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { generateVerifyToken } from '@/lib/authTokens';
import { getSiteUrl } from '@/lib/siteUrl';

const SUPABASE_URL = 'https://phvewrldcdxupsnakddx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBodmV3cmxkY2R4dXBzbmFrZGR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDA0NjMsImV4cCI6MjA5MDc3NjQ2M30.xHGPMphDjMsPN566gRcGle5Mp8mEBxGiI1HXDX9M7ZU';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const userId = url.searchParams.get('uid');

    if (!token || !userId) {
      return NextResponse.redirect(`${getSiteUrl()}/login?error=invalid_link`);
    }

    const admin = getSupabaseAdmin();

    const { data: { user }, error: userError } = await admin.auth.admin.getUserById(userId);
    if (userError || !user) {
      return NextResponse.redirect(`${getSiteUrl()}/login?error=user_not_found`);
    }

    const expectedToken = generateVerifyToken(userId, user.email || '');
    if (token !== expectedToken) {
      return NextResponse.redirect(`${getSiteUrl()}/login?error=invalid_token`);
    }

    if (!user.email_confirmed_at) {
      await admin.auth.admin.updateUserById(userId, { email_confirm: true });
      console.log(`[VerifyEmail] Email confirmed for ${user.email}`);
    } else {
      console.log(`[VerifyEmail] Email already confirmed for ${user.email}`);
    }

    // Redirect directly to login — skip magic link to avoid Supabase
    // redirect-URL allowlist issues across different deployments.
    return NextResponse.redirect(`${getSiteUrl()}/login?verified=true`);
  } catch (err: any) {
    console.error('[VerifyEmail] error:', err.message);
    return NextResponse.redirect(`${getSiteUrl()}/login?error=verify_failed`);
  }
}
