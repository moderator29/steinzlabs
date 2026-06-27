import 'server-only';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type CheckResult = 'ok' | 'skipped' | { error: string };

interface HealthResponse {
  status: 'ok' | 'degraded' | 'misconfigured';
  durationMs: number;
  env: {
    SUPABASE_SERVICE_KEY: boolean;
    RESEND_API_KEY: boolean;
    JWT_SECRET: boolean;
    ANTHROPIC_API_KEY: boolean;
    NEXT_PUBLIC_SITE_URL: string;
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: boolean;
    VERCEL_URL: string;
    NODE_ENV: string;
  };
  checks: {
    supabase: CheckResult;
    coingecko: CheckResult;
    anthropic: CheckResult;
  };
  // WalletConnect / Reown AppKit diagnostic. Cross-check `expectedOrigin`
  // against the Verify domain allowlist in your Reown dashboard — a mismatch
  // (or a truncated project id) is the usual cause of connect failures.
  walletconnect: {
    projectIdPresent: boolean;
    projectIdLength: number;
    expectedOrigin: string;
  };
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms),
    ),
  ]);
}

async function checkSupabase(): Promise<CheckResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 'skipped';
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const admin = createClient(url, key.trim(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const result = await withTimeout(
      Promise.resolve(admin.from('profiles').select('id').limit(1)),
      3000,
    );
    return result.error ? { error: result.error.message } : 'ok';
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'unknown' };
  }
}

async function checkCoinGecko(): Promise<CheckResult> {
  try {
    const res = await withTimeout(
      fetch('https://api.coingecko.com/api/v3/ping', { cache: 'no-store' }),
      3000,
    );
    return res.ok ? 'ok' : { error: `status ${res.status}` };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : 'unknown' };
  }
}

async function checkAnthropic(): Promise<CheckResult> {
  if (!process.env.ANTHROPIC_API_KEY) return 'skipped';
  // Lightweight check: just verify the key shape — a real ping costs tokens.
  return /^sk-ant-/.test(process.env.ANTHROPIC_API_KEY) ? 'ok' : { error: 'malformed key' };
}

export async function GET() {
  const startedAt = Date.now();
  const [supabase, coingecko, anthropic] = await Promise.all([
    checkSupabase(),
    checkCoinGecko(),
    checkAnthropic(),
  ]);

  const env: HealthResponse['env'] = {
    SUPABASE_SERVICE_KEY:
      !!process.env.SUPABASE_SERVICE_KEY || !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    JWT_SECRET: !!process.env.JWT_SECRET,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || '(not set)',
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: !!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    VERCEL_URL: process.env.VERCEL_URL || '(not set)',
    NODE_ENV: process.env.NODE_ENV || '(not set)',
  };

  const failed = [supabase, coingecko, anthropic].some(
    (c) => typeof c === 'object' && 'error' in c,
  );
  const misconfigured = supabase === 'skipped' || !env.RESEND_API_KEY;

  // Resolve the origin AppKit will run under so it can be checked against the
  // Reown Verify allowlist. Prefer the explicit site URL; fall back to VERCEL_URL.
  const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';
  const expectedOrigin = (() => {
    const raw = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
    try { return raw ? new URL(raw).origin : '(unknown)'; } catch { return '(invalid NEXT_PUBLIC_SITE_URL)'; }
  })();

  const body: HealthResponse = {
    status: misconfigured ? 'misconfigured' : failed ? 'degraded' : 'ok',
    durationMs: Date.now() - startedAt,
    env,
    checks: { supabase, coingecko, anthropic },
    walletconnect: {
      projectIdPresent: !!wcProjectId,
      projectIdLength: wcProjectId.length,
      expectedOrigin,
    },
  };

  return NextResponse.json(body, {
    status: body.status === 'ok' ? 200 : body.status === 'degraded' ? 503 : 500,
    headers: { 'Cache-Control': 'no-store' },
  });
}
