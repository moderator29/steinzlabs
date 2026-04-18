import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';

// Phase 6 — rich follow payload (alert threshold + channels, copy-trade rules).
// Persists both the follow row and, when mode ≠ 'alerts', a copy-rules row.
// Rules schema is forward-compatible: extra fields dropped by Postgres if columns
// don't exist; service_role writes bypass RLS.

export const runtime = 'nodejs';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {}, remove() {},
      },
    },
  );
}

export const POST = withTierGate('pro', async (
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) => {
  const { address } = await params;
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    chain?: string;
    mode?: 'alerts' | 'one_click' | 'auto';
    alert_threshold_usd?: number;
    alert_channels?: string[];
    copy_rules?: {
      max_per_trade_usd?: number;
      daily_cap_usd?: number;
      slippage_pct?: number;
      allowed_chains?: string[];
    } | null;
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }

  if (!body.chain) return NextResponse.json({ error: 'Missing chain' }, { status: 400 });
  const mode = body.mode || 'alerts';

  // 1) Upsert follow record
  const followRow: Record<string, unknown> = {
    user_id: user.id,
    whale_address: address,
    chain: body.chain,
    copy_mode: mode,
    alert_enabled: true,
    alert_threshold_usd: body.alert_threshold_usd ?? null,
    alert_channels: body.alert_channels ?? ['push'],
  };
  const { error: followErr } = await supabase
    .from('user_whale_follows')
    .upsert(followRow, { onConflict: 'user_id,whale_address,chain' });
  if (followErr) return NextResponse.json({ error: followErr.message }, { status: 500 });

  // 2) Copy rules (if applicable)
  if (mode !== 'alerts' && body.copy_rules) {
    // Phase 10 audit fix: DB columns are `chains_allowed` + `max_slippage_bps` (integer),
    // not the field names in the UI. Map here rather than asking the UI to know DB internals.
    const slippagePct = body.copy_rules.slippage_pct ?? null;
    const ruleRow: Record<string, unknown> = {
      user_id: user.id,
      whale_address: address,
      chain: body.chain,
      max_per_trade_usd: body.copy_rules.max_per_trade_usd ?? null,
      daily_cap_usd: body.copy_rules.daily_cap_usd ?? null,
      max_slippage_bps: slippagePct != null ? Math.round(slippagePct * 100) : null,
      chains_allowed: body.copy_rules.allowed_chains ?? [body.chain],
      require_confirmation: mode === 'one_click',
      enabled: true,
    };
    const { error: ruleErr } = await supabase
      .from('user_copy_rules')
      .upsert(ruleRow, { onConflict: 'user_id,whale_address,chain' });
    // Non-fatal — follow still succeeds. UI should warn if rules didn't save.
    if (ruleErr) {
      return NextResponse.json({
        ok: true,
        warning: `Follow saved but copy rules failed: ${ruleErr.message}`,
      });
    }
  }

  return NextResponse.json({ ok: true });
});

export const DELETE = withTierGate('pro', async (
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) => {
  const { address } = await params;
  const chain = request.nextUrl.searchParams.get('chain');
  if (!chain) return NextResponse.json({ error: 'Missing chain' }, { status: 400 });
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await Promise.all([
    supabase.from('user_whale_follows').delete()
      .eq('user_id', user.id).eq('whale_address', address).eq('chain', chain),
    supabase.from('user_copy_rules').delete()
      .eq('user_id', user.id).eq('whale_address', address).eq('chain', chain),
  ]);
  return NextResponse.json({ ok: true });
});
