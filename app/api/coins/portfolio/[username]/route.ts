import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getUserPositions } from '@/lib/coins/social';

export const dynamic = 'force-dynamic';

/**
 * Public coin portfolio for a profile: the coins they hold on Naka (from settled
 * trades) valued at live registry prices, plus the total. Gated by the profile's
 * own visibility toggles. Real data only; empty when hidden or when they hold
 * nothing.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const sb = getSupabaseAdmin();

  const { data: prof } = await sb
    .from('profiles')
    .select('id, username, show_wallet_balance, show_holdings')
    .ilike('username', username)
    .maybeSingle();
  if (!prof) return NextResponse.json({ showBalance: false, showHoldings: false, holdings: [], coinsValueUsd: 0 });

  const showBalance = (prof as { show_wallet_balance: boolean }).show_wallet_balance !== false;
  const showHoldings = (prof as { show_holdings: boolean }).show_holdings !== false;
  if (!showHoldings) return NextResponse.json({ showBalance, showHoldings: false, holdings: [], coinsValueUsd: 0 });

  const positions = await getUserPositions((prof as { id: string }).id, true).catch(() => []);
  if (positions.length === 0) return NextResponse.json({ showBalance, showHoldings, holdings: [], coinsValueUsd: 0 });

  const keys = positions.map((p) => p.tokenKey);
  const { data: reg } = await sb
    .from('coin_registry')
    .select('chain, token_key, token_address, symbol, name, logo_url, price_usd, change_24h')
    .in('token_key', keys);
  const meta = new Map<string, Record<string, unknown>>();
  for (const r of (reg as Array<Record<string, unknown>>) ?? []) meta.set(`${r.chain}:${r.token_key}`, r);

  const holdings = positions
    .map((p) => {
      const m = meta.get(`${p.chain}:${p.tokenKey}`);
      const price = m?.price_usd != null ? Number(m.price_usd) : null;
      const usdValue = price != null ? p.netTokens * price : null;
      return {
        chain: p.chain,
        tokenAddress: (m?.token_address as string) || p.tokenAddress,
        tokenKey: p.tokenKey,
        symbol: (m?.symbol as string) || p.symbol || '',
        logoUrl: (m?.logo_url as string) ?? null,
        usdValue,
        change24h: m?.change_24h != null ? Number(m.change_24h) : null,
      };
    })
    .filter((h) => h.usdValue != null && h.usdValue > 0)
    .sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));

  const coinsValueUsd = holdings.reduce((s, h) => s + (h.usdValue ?? 0), 0);
  return NextResponse.json({ showBalance, showHoldings, holdings, coinsValueUsd });
}
