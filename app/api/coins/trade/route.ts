import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { recordTrade, getUserPositions, getUserTradeStatement } from '@/lib/coins/social';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isCoinChain } from '@/lib/coins/types';

export const dynamic = 'force-dynamic';

/**
 * GET: the caller's positions valued from the registry price cache (fast, no
 * live fan-out), or a monthly statement when ?statement=YYYY-MM is passed.
 */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const url = new URL(req.url);
  const month = url.searchParams.get('statement');
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const statement = await getUserTradeStatement(user.id, month);
    return NextResponse.json({ statement });
  }

  const openOnly = url.searchParams.get('open') !== '0';
  const positions = await getUserPositions(user.id, openOnly);
  if (positions.length === 0) return NextResponse.json({ positions: [] });

  // Value with cached registry prices + logos (fast).
  const sb = getSupabaseAdmin();
  const keys = positions.map((p) => p.tokenKey);
  const { data } = await sb
    .from('coin_registry')
    .select('chain, token_key, symbol, name, logo_url, price_usd, market_cap_usd, change_24h')
    .in('token_key', keys);
  const meta = new Map<string, Record<string, unknown>>();
  for (const r of (data as Array<Record<string, unknown>>) ?? []) meta.set(`${r.chain}:${r.token_key}`, r);

  const valued = positions.map((p) => {
    const m = meta.get(`${p.chain}:${p.tokenKey}`);
    const price = m?.price_usd != null ? Number(m.price_usd) : null;
    const usdValue = price != null ? p.netTokens * price : null;
    const unrealizedPct = p.avgBuyPrice && p.avgBuyPrice > 0 && price != null ? ((price - p.avgBuyPrice) / p.avgBuyPrice) * 100 : null;
    return {
      chain: p.chain,
      tokenAddress: p.tokenAddress,
      tokenKey: p.tokenKey,
      symbol: (m?.symbol as string) || p.symbol || '',
      name: (m?.name as string) || p.symbol || '',
      logoUrl: (m?.logo_url as string) ?? null,
      netTokens: p.netTokens,
      avgBuyPrice: p.avgBuyPrice,
      priceUsd: price,
      usdValue,
      marketCapUsd: m?.market_cap_usd != null ? Number(m.market_cap_usd) : null,
      change24h: m?.change_24h != null ? Number(m.change_24h) : null,
      realizedUsd: p.realizedUsd,
      unrealizedPct,
      firstBuyMs: p.firstBuyMs,
      tradeCount: p.tradeCount,
    };
  });
  valued.sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));
  return NextResponse.json({ positions: valued });
}

/** POST: record a settled trade after the wallet broadcast confirms. */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const chain = String(b.chain || '');
  const address = String(b.address || '');
  const side = b.side === 'sell' ? 'sell' : 'buy';
  if (!isCoinChain(chain) || !address) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const usdAmount = Number(b.usdAmount) || 0;
  const tokenAmount = Number(b.tokenAmount) || 0;
  if (usdAmount <= 0 || tokenAmount <= 0) return NextResponse.json({ error: 'Invalid amounts' }, { status: 400 });

  const rec = await recordTrade({
    userId: user.id,
    chain,
    address,
    symbol: b.symbol ? String(b.symbol) : null,
    side,
    usdAmount,
    tokenAmount,
    priceUsd: b.priceUsd != null ? Number(b.priceUsd) : null,
    marketCapUsd: b.marketCapUsd != null ? Number(b.marketCapUsd) : null,
    txHash: b.txHash ? String(b.txHash) : null,
  });
  if (!rec) return NextResponse.json({ error: 'Could not record trade' }, { status: 500 });
  return NextResponse.json({ id: rec.id });
}
