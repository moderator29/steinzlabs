import 'server-only';
import { NextRequest, NextResponse, after } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';
import { sendTelegramNotification } from '@/lib/telegram/notify';
import { sendPushToUser } from '@/lib/services/webpush';
import { sendBroadcast } from '@/lib/services/resend';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

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

/**
 * Fire a real-time "you're now following X" confirmation across the channels
 * the user just opted into, so they get immediate proof the channel works
 * (especially Telegram, right after linking). Best-effort and fully detached
 * via after() — never blocks or fails the follow response. Telegram/push
 * self-check link + subscription state internally.
 */
async function sendFollowConfirmation(opts: {
  userId: string;
  email: string | null;
  whaleName: string;
  chain: string;
  thresholdUsd: number | null;
  channels: string[];
}): Promise<void> {
  const { userId, email, whaleName, chain, thresholdUsd, channels } = opts;
  const thresholdLabel = thresholdUsd ? `$${thresholdUsd.toLocaleString()}` : 'any size';
  const title = `🐋 Now following ${whaleName}`;
  const body = `You'll get alerts when ${whaleName} trades ${thresholdLabel}+ on ${chain}.`;
  const url = '/dashboard/whale-tracker';

  if (channels.includes('telegram')) {
    try { await sendTelegramNotification({ userId, kind: 'whale', title, body, url }); } catch { /* logged in notify */ }
  }
  if (channels.includes('push')) {
    try { await sendPushToUser(userId, { title, body, url, tag: 'whale-follow' }); } catch { /* best-effort */ }
  }
  if (channels.includes('email') && email) {
    try {
      await sendBroadcast({
        to: email,
        subject: title,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#f1f5f9;padding:32px;border-radius:12px">
          <h2 style="margin:0 0 12px">${title}</h2>
          <p style="color:#94a3b8;margin:0 0 16px">${body}</p>
          <hr style="border:none;border-top:1px solid #1e293b;margin:20px 0"/>
          <p style="font-size:12px;color:#475569">Naka Labs Whale Alerts</p>
        </div>`,
        tags: [{ name: 'type', value: 'whale_follow_confirmation' }],
      });
    } catch { /* best-effort */ }
  }
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

  // Normalize so a checksummed EVM address from the follow modal targets the
  // same DB key as the lowercase-stored whale (Solana stays case-preserved).
  const normalizedAddress = normalizeAddress(address, body.chain);

  // 1) Upsert follow record
  const followRow: Record<string, unknown> = {
    user_id: user.id,
    whale_address: normalizedAddress,
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

  // Real-time confirmation across the chosen channels (detached — never blocks).
  const confirmChannels = body.alert_channels ?? ['push'];
  const whaleName = address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
  after(() => sendFollowConfirmation({
    userId: user.id,
    email: user.email ?? null,
    whaleName,
    chain: body.chain!,
    thresholdUsd: body.alert_threshold_usd ?? null,
    channels: confirmChannels,
  }));

  // 2) Copy rules (if applicable)
  if (mode !== 'alerts' && body.copy_rules) {
    // Phase 10 audit fix: DB columns are `chains_allowed` + `max_slippage_bps` (integer),
    // not the field names in the UI. Map here rather than asking the UI to know DB internals.
    const slippagePct = body.copy_rules.slippage_pct ?? null;
    // CRITICAL: the copy engine keys off user_copy_rules.mode. copy-trade-monitor
    // skips any rule whose mode is null/off/manual, and the webhook matcher reads
    // the exact 'oneclick'/'auto_copy' values — so without writing mode here every
    // rule created from the Follow modal was silently ignored by the live cron.
    const canonicalMode = mode === 'auto' ? 'auto_copy' : 'oneclick';
    const ruleRow: Record<string, unknown> = {
      user_id: user.id,
      whale_address: normalizedAddress,
      chain: body.chain,
      mode: canonicalMode,
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

  // Normalize so a detail-page unfollow (which may carry a checksummed EVM
  // address) deletes the same row the modal follow wrote.
  const normalizedAddress = normalizeAddress(address, chain);

  await Promise.all([
    supabase.from('user_whale_follows').delete()
      .eq('user_id', user.id).eq('whale_address', normalizedAddress).eq('chain', chain),
    supabase.from('user_copy_rules').delete()
      .eq('user_id', user.id).eq('whale_address', normalizedAddress).eq('chain', chain),
  ]);
  return NextResponse.json({ ok: true });
});
