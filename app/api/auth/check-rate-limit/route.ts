import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 10;
const BLOCK_MINUTES = 15;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase admin credentials missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    '127.0.0.1'
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let identifier: string | undefined;
  let action: string | undefined;

  try {
    const body = await request.json() as { identifier?: string; action?: string };
    identifier = body.identifier;
    action = body.action ?? 'auth';
  } catch {
    return NextResponse.json({ allowed: false, error: 'Invalid request' }, { status: 400 });
  }

  const ip = getClientIp(request);
  const key = `${action}:${ip}:${identifier ?? 'anon'}`;
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000);

  try {
    const supabase = getSupabaseAdmin();

    // Check for active block first
    const { data: blockRecord } = await supabase
      .from('auth_rate_limits')
      .select('blocked_until')
      .eq('key', key)
      .not('blocked_until', 'is', null)
      .gt('blocked_until', now.toISOString())
      .maybeSingle();

    if (blockRecord) {
      const retryAfter = Math.ceil(
        (new Date(blockRecord.blocked_until as string).getTime() - now.getTime()) / 1000,
      );
      return NextResponse.json({
        allowed: false,
        blocked: true,
        retryAfterSeconds: retryAfter,
        error: `Too many attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
      }, { status: 429 });
    }

    // Count attempts in window
    const { count } = await supabase
      .from('auth_rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('key', key)
      .gte('attempted_at', windowStart.toISOString());

    const attempts = count ?? 0;

    if (attempts >= MAX_ATTEMPTS) {
      // Insert a block record
      const blockedUntil = new Date(now.getTime() + BLOCK_MINUTES * 60 * 1000).toISOString();
      await supabase.from('auth_rate_limits').insert({
        key,
        ip,
        identifier: identifier ?? null,
        action,
        attempted_at: now.toISOString(),
        blocked_until: blockedUntil,
      });

      return NextResponse.json({
        allowed: false,
        blocked: true,
        retryAfterSeconds: BLOCK_MINUTES * 60,
        error: `Too many attempts. Try again in ${BLOCK_MINUTES} minutes.`,
      }, { status: 429 });
    }

    // Record this attempt
    await supabase.from('auth_rate_limits').insert({
      key,
      ip,
      identifier: identifier ?? null,
      action,
      attempted_at: now.toISOString(),
      blocked_until: null,
    });

    return NextResponse.json({
      allowed: true,
      attemptsUsed: attempts + 1,
      attemptsRemaining: MAX_ATTEMPTS - attempts - 1,
    });
  } catch (err) {
    // Fail open — don't block users if rate limit DB is unavailable
    console.error('[check-rate-limit] Error:', err);
    return NextResponse.json({ allowed: true, failOpen: true });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // Clear rate limit for an IP (called after successful auth)
  let identifier: string | undefined;
  try {
    const body = await request.json() as { identifier?: string; action?: string };
    identifier = body.identifier;
  } catch { /* ignore */ }

  const ip = getClientIp(request);

  try {
    const supabase = getSupabaseAdmin();
    await supabase
      .from('auth_rate_limits')
      .delete()
      .like('key', `%:${ip}:%`);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false });
  }
}
