import 'server-only';
import { NextResponse } from 'next/server';

export async function GET() {
  const checks: Record<string, any> = {
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    JWT_SECRET: !!process.env.JWT_SECRET,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || '(not set)',
    VERCEL_URL: process.env.VERCEL_URL || '(not set)',
    NODE_ENV: process.env.NODE_ENV || '(not set)',
  };

  // Test actual Supabase admin connection
  if (process.env.SUPABASE_SERVICE_KEY) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const admin = createClient(
        'https://phvewrldcdxupsnakddx.supabase.co',
        process.env.SUPABASE_SERVICE_KEY.trim(),
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { error } = await admin.from('profiles').select('id').limit(1);
      checks.supabase_connection = error ? `error: ${error.message}` : 'ok';
    } catch (e: any) {
      checks.supabase_connection = `exception: ${e.message}`;
    }
  } else {
    checks.supabase_connection = 'skipped (no key)';
  }

  const allGood =
    checks.SUPABASE_SERVICE_KEY &&
    checks.RESEND_API_KEY &&
    checks.supabase_connection === 'ok';

  return NextResponse.json({
    status: allGood ? 'ok' : 'misconfigured',
    env: checks,
  });
}
