import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';
import { getTokenSecurity } from '@/lib/services/goplus';
import { searchPairs } from '@/lib/services/dexscreener';
import { vtxAnalyze } from '@/lib/services/anthropic';
import { createSniperExecution } from '@/lib/services/supabase';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';

export const runtime = 'nodejs';

const schema = z.object({
  address: z.string().min(1).max(100),
  chain: z.string().default('ethereum'),
  amount: z.number().positive().finite(),
  slippage: z.number().min(0.1).max(50).default(1),
});

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );
}

const MAX_SNIPE_AMOUNT = 500;

/**
 * 5-Step Sniper Safety Flow:
 * 1. GoPlus honeypot + tax scan
 * 2. Sell tax / buy tax threshold check (max 10%)
 * 3. Holder concentration check (top 10 holders < 80%)
 * 4. Liquidity depth check (min $10k)
 * 5. VTX AI risk assessment — final go/no-go
 *
 * Auth: Pro tier required (withTierGate). user_id is derived from the
 * authenticated session — never accepted from the request body, which
 * previously allowed cross-user execution-history pollution.
 */
export const POST = withTierGate('max', async (req: NextRequest) => {
  const t0 = Date.now();
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  // C.7: Idempotency-Key replay protection. Clients that retry a failed
  // execute call (network blip, browser refresh, etc) can attach the
  // same key and the route returns the cached response instead of
  // double-executing the snipe.
  const { checkIdempotency, saveIdempotency } = await import('@/lib/api/idempotency');
  const cached = await checkIdempotency(req, user.id, '/api/sniper/execute', parsed.data);
  if (cached) return cached;

  const { address, chain, amount, slippage } = parsed.data;
  const steps: { step: number; label: string; passed: boolean; detail: string }[] = [];

  // Step 0: kill switch from platform_settings
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabaseAdmin');
    const db = getSupabaseAdmin();
    // The real kill switch is the singleton platform_sniper_state(id=1).
    // (The old code read platform_settings.key/enabled — columns that do not
    // exist — so it threw and fail-closed-blocked 100% of snipes.)
    const { data: setting } = await db.from('platform_sniper_state').select('enabled').eq('id', 1).single();
    if (setting && setting.enabled === false) {
      return NextResponse.json({ blocked: true, reason: 'Sniper bot is currently disabled by admin.', steps });
    }
  } catch (err) {
    // CLAUDE.md: no console.error in production — Sentry already
    // captures below. Fail CLOSED ("blocked") so a DB outage can never
    // green-light a snipe past the kill-switch.
    Sentry.captureException(err, { tags: { route: 'sniper/execute', stage: 'killswitch-check' } });
    return NextResponse.json({ blocked: true, reason: 'Safety system unavailable. Snipe blocked for protection.' });
  }

  // Step 0b: per-snipe budget cap
  if (amount > MAX_SNIPE_AMOUNT) {
    return NextResponse.json({ blocked: true, reason: `Maximum snipe amount is $${MAX_SNIPE_AMOUNT}. You requested $${amount}.`, steps });
  }

  let sec;
  try {
    sec = await getTokenSecurity(address, chain);
  } catch {
    return NextResponse.json({ blocked: true, reason: 'Security scan unavailable', steps });
  }

  steps.push({ step: 1, label: 'Honeypot Check', passed: !sec.isHoneypot, detail: sec.isHoneypot ? 'HONEYPOT DETECTED — cannot sell' : 'Not a honeypot' });
  if (sec.isHoneypot) return NextResponse.json({ blocked: true, reason: 'Honeypot detected', steps });

  const maxTax = Math.max(sec.buyTax, sec.sellTax);
  const taxOk = maxTax <= 0.10;
  steps.push({ step: 2, label: 'Tax Check (≤10%)', passed: taxOk, detail: `Buy: ${(sec.buyTax * 100).toFixed(1)}% / Sell: ${(sec.sellTax * 100).toFixed(1)}%` });
  if (!taxOk) return NextResponse.json({ blocked: true, reason: `Tax too high: sell ${(sec.sellTax * 100).toFixed(0)}%`, steps });

  const raw = sec.raw as Record<string, unknown> | undefined;
  const holders = Array.isArray(raw?.holders) ? (raw!.holders as Array<Record<string, unknown>>) : [];
  // GoPlus reports each holder's `percent` as a 0..1 FRACTION (0.05 = 5%) — the
  // same convention token-detail's mapHolders multiplies by 100. Summing the raw
  // fractions and comparing against 80 made this gate dead: a token whose top 10
  // hold 90% summed to ~0.9, and 0.9 < 80 always "passed". Convert to a real
  // percent so the concentration block actually fires. (Strengthens step 3 —
  // does not weaken any existing check; empty holder lists still sum to 0 and
  // defer to the other gates, never fabricating concentration.)
  const top10Pct = holders.slice(0, 10).reduce((s, h) => s + (parseFloat(String(h.percent ?? '0')) || 0), 0) * 100;
  const concentrationOk = top10Pct < 80;
  steps.push({ step: 3, label: 'Holder Concentration (<80%)', passed: concentrationOk, detail: `Top 10 holders: ${top10Pct.toFixed(1)}%` });
  if (!concentrationOk) return NextResponse.json({ blocked: true, reason: `Top 10 holders control ${top10Pct.toFixed(0)}%`, steps });

  const pairs = await searchPairs(address).catch(() => []);
  const liq = pairs[0]?.liquidity?.usd ?? 0;
  const liqOk = liq >= 10_000;
  steps.push({ step: 4, label: 'Liquidity Check (≥$10k)', passed: liqOk, detail: `Pool liquidity: $${liq.toLocaleString()}` });
  if (!liqOk) return NextResponse.json({ blocked: true, reason: `Insufficient liquidity: $${liq.toLocaleString()}`, steps });

  const aiText = await vtxAnalyze(
    `Sniper safety check. Token: ${address} on ${chain}. Tax: buy ${(sec.buyTax*100).toFixed(1)}% sell ${(sec.sellTax*100).toFixed(1)}%. Top10 holders: ${top10Pct.toFixed(1)}%. Liquidity: $${liq.toLocaleString()}. Holder count: ${sec.holderCount}. Open source: ${sec.isOpenSource}. Mintable: ${sec.isMintable}. Start with RISK: LOW/MEDIUM/HIGH/CRITICAL. One sentence why.`,
    200
  ).catch(() => 'RISK: MEDIUM — Unable to complete AI analysis.');

  const aiBlocked = /RISK:\s*(HIGH|CRITICAL)/i.test(aiText);
  steps.push({ step: 5, label: 'AI Risk Assessment', passed: !aiBlocked, detail: aiText.split('\n')[0] });
  if (aiBlocked) return NextResponse.json({ blocked: true, reason: 'AI flagged high risk', aiReason: aiText, steps });

  // Server-derived user.id — client cannot pollute another user's history.
  // Retry with backoff handled inside createSniperExecution; Sentry captures
  // a terminal failure so safety-gate persistence regressions are visible.
  const executionTimeMs = Date.now() - t0;
  const persist = await createSniperExecution({
    user_id: user.id,
    token_address: address,
    chain,
    buy_amount_usd: amount,
    tx_hash: null,
    status: 'queued',
    execution_time_ms: executionTimeMs,
  });
  if (persist.error) {
    Sentry.captureException(new Error(`sniper_executions insert failed: ${persist.error}`), {
      tags: { route: 'sniper/execute', stage: 'persist-queued' },
      extra: { user_id: user.id, token_address: address, chain, execution_time_ms: executionTimeMs },
    });
  }

  const successPayload = {
    blocked: false,
    approved: true,
    steps,
    liquidity: liq,
    slippage,
    pair: pairs[0]?.pairAddress ?? null,
    price: pairs[0]?.priceUsd ? parseFloat(pairs[0].priceUsd) : null,
    execution_time_ms: executionTimeMs,
  };
  // C.7: cache the success response so a retry with the same
  // Idempotency-Key replays this exact payload instead of double-queueing
  // the snipe.
  await saveIdempotency(req, user.id, '/api/sniper/execute', parsed.data, 200, successPayload);
  return NextResponse.json(successPayload);
});
