import { NextResponse } from 'next/server';

export async function GET() {
  const checks = {
    SUPABASE_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_KEY,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    JWT_SECRET: !!process.env.JWT_SECRET,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || '(not set)',
    VERCEL_URL: process.env.VERCEL_URL || '(not set)',
    NODE_ENV: process.env.NODE_ENV || '(not set)',
  };

  const allGood = checks.SUPABASE_SERVICE_KEY && checks.RESEND_API_KEY;

  return NextResponse.json({
    status: allGood ? 'ok' : 'misconfigured',
    env: checks,
  });
}
