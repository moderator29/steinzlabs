import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * Latest coin moments for the Moments strip. Returns the ~20 most recent real
 * detected events joined to coin_registry for a live logo and symbol. Newest
 * first. Empty array when there are none; we never invent a moment.
 */

interface MomentRow {
  id: string;
  kind: string;
  chain: string;
  token_key: string;
  token_address: string;
  symbol: string | null;
  headline: string;
  detail: string | null;
  market_cap_usd: number | string | null;
  created_at: string;
}

interface RegistryRow {
  chain: string;
  token_key: string;
  symbol: string | null;
  logo_url: string | null;
}

export async function GET() {
  const db = getSupabaseAdmin();

  const { data: moments } = await db
    .from('coin_moments')
    .select('id, kind, chain, token_key, token_address, symbol, headline, detail, market_cap_usd, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const rows = (moments as MomentRow[]) ?? [];
  if (rows.length === 0) return NextResponse.json({ moments: [] });

  // One registry lookup for logos, keyed by chain:token_key.
  const tokenKeys = [...new Set(rows.map((r) => r.token_key))];
  const { data: reg } = await db
    .from('coin_registry')
    .select('chain, token_key, symbol, logo_url')
    .in('token_key', tokenKeys);

  const logos = new Map<string, RegistryRow>();
  for (const r of (reg as RegistryRow[]) ?? []) {
    logos.set(`${r.chain}:${r.token_key}`, r);
  }

  const out = rows.map((r) => {
    const reg = logos.get(`${r.chain}:${r.token_key}`);
    return {
      id: r.id,
      kind: r.kind,
      chain: r.chain,
      token_key: r.token_key,
      token_address: r.token_address,
      symbol: (r.symbol || reg?.symbol || null),
      logo_url: reg?.logo_url ?? null,
      headline: r.headline,
      detail: r.detail,
      market_cap_usd: r.market_cap_usd == null ? null : Number(r.market_cap_usd),
      created_at: r.created_at,
    };
  });

  return NextResponse.json({ moments: out });
}
