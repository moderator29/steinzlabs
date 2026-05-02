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
export const POST = withTierGate('pro', async (req: NextRequest) => {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { address, chain, amount, slippage } = parsed.data;
  void slippage;
  const steps: { step: number; label: string; passed: boolean; detail: string }[] = [];

  // Step 0: kill switch from platform_settings
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabaseAdmin');
    const db = getSupabaseAdmin();
    const { data: setting } = await db.from('platform_settings').select('enabled').eq('key', 'sniper_enabled').single();
    if (setting && setting.enabled === false) {
      return NextResponse.json({ blocked: true, reason: 'Sniper bot is currently disabled by admin.', steps });
    }
  } catch (err) {
    console.error('[Sniper] Kill switch DB check failed:', err);
    Sentry.captureException(err);
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
  const top10Pct = holders.slice(0, 10).reduce((s, h) => s + parseFloat(String(h.percent ?? '0')), 0);
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
  createSniperExecution({
    user_id: user.id,
    token_address: address,
    chain,
    buy_amount_usd: amount,
    tx_hash: null,
    status: 'queued',
  }).catch(() => {});

  return NextResponse.json({ blocked: false, approved: true, steps, liquidity: liq, pair: pairs[0]?.pairAddress ?? null, price: pairs[0]?.priceUsd ? parseFloat(pairs[0].priceUsd) : null });
});
