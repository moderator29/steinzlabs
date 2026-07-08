import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

/**
 * Whale DNA — a wallet's behavioral fingerprint + "wallets that trade like
 * this one" (nearest neighbours in the curated whale directory).
 *
 * GET /api/whale-tracker/dna?address=0x...
 *
 * Similarity is a weighted blend of real, per-wallet signals: same archetype,
 * close win-rate / whale-score / hold-time, and token-overlap (Jaccard) from
 * whale_activity. Two-pass for efficiency — metric similarity over all whales
 * to shortlist, then token-overlap refinement only on the shortlist.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface WhaleRow {
  address: string; chain: string; label: string | null; entity_type: string | null;
  win_rate: number | null; whale_score: number | null;
  pnl_30d_usd: number | null; portfolio_value_usd: number | null; volume_7d_usd: number | null;
  trade_count_30d: number | null; avg_hold_hours: number | null;
  archetype: string | null; verified: boolean | null; logo_url: string | null;
  // Persisted unique Naka display number (whales.naka_number); null when absent.
  naka_number: number | null;
}

const BUY_ACTIONS = new Set(['buy', 'transfer_in', 'swap']);
const SHORTLIST = 30;
const RESULTS = 8;

function num(v: number | null | undefined): number | null { return v == null ? null : Number(v); }

// Metric-only similarity (0..1) between two whales — used to shortlist before
// the heavier token-overlap pass.
function metricSim(t: WhaleRow, c: WhaleRow): number {
  let score = 0, weight = 0;
  // archetype (exact match)
  if (t.archetype && c.archetype) {
    score += (t.archetype.toLowerCase() === c.archetype.toLowerCase() ? 1 : 0) * 0.35;
    weight += 0.35;
  }
  // win rate (0..100)
  const wt = num(t.win_rate), wc = num(c.win_rate);
  if (wt != null && wc != null) { score += (1 - Math.min(1, Math.abs(wt - wc) / 100)) * 0.25; weight += 0.25; }
  // whale score (0..100)
  const st = num(t.whale_score), sc = num(c.whale_score);
  if (st != null && sc != null) { score += (1 - Math.min(1, Math.abs(st - sc) / 100)) * 0.2; weight += 0.2; }
  // avg hold (hours, log-scaled distance)
  const ht = num(t.avg_hold_hours), hc = num(c.avg_hold_hours);
  if (ht != null && hc != null && ht > 0 && hc > 0) {
    const d = Math.abs(Math.log10(ht + 1) - Math.log10(hc + 1)) / 3; // ~3 decades
    score += (1 - Math.min(1, d)) * 0.2; weight += 0.2;
  }
  return weight > 0 ? score / weight : 0;
}

async function tokenSets(admin: ReturnType<typeof getSupabaseAdmin>, addresses: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (addresses.length === 0) return out;
  // whale_activity holds legacy EVM rows in MIXED case, so an exact
  // .in('whale_address', <canonical/lowercase>) under-counts them and
  // undercounts token overlap. Match case-insensitively via ilike (hex/base58
  // have no LIKE wildcards) and key the result map on the NORMALIZED address so
  // callers can look up by their canonical whales.address on both sides.
  const { data } = await admin
    .from('whale_activity')
    .select('whale_address, action, token_symbol')
    .or(addresses.map((a) => `whale_address.ilike.${a}`).join(','))
    .order('timestamp', { ascending: false })
    .limit(4000);
  for (const a of (data ?? []) as Array<{ whale_address: string; action: string | null; token_symbol: string | null }>) {
    if (!a.token_symbol || !BUY_ACTIONS.has((a.action ?? '').toLowerCase())) continue;
    const key = normalizeAddress(a.whale_address);
    const s = out.get(key) ?? new Set<string>();
    s.add(a.token_symbol.toUpperCase());
    out.set(key, s);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const SELECT = 'address, chain, label, entity_type, win_rate, whale_score, pnl_30d_usd, portfolio_value_usd, volume_7d_usd, trade_count_30d, avg_hold_hours, archetype, verified, logo_url, naka_number';

export async function GET(req: NextRequest) {
  const address = (req.nextUrl.searchParams.get('address') || '').trim();
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: targetRows } = await admin.from('whales').select(SELECT).ilike('address', address).limit(1);
  const target = (targetRows ?? [])[0] as WhaleRow | undefined;
  if (!target) return NextResponse.json({ found: false, address });

  // Candidate pool: active whales on the same chain first (behaviour is chain-
  // shaped), then fall back to all chains if the chain is thin.
  const { data: sameChain } = await admin.from('whales').select(SELECT).eq('is_active', true).eq('chain', target.chain).limit(600);
  let pool = (sameChain ?? []) as WhaleRow[];
  if (pool.length < 20) {
    const { data: all } = await admin.from('whales').select(SELECT).eq('is_active', true).limit(600);
    pool = (all ?? []) as WhaleRow[];
  }
  pool = pool.filter((w) => w.address.toLowerCase() !== target.address.toLowerCase());

  // Pass 1 — metric shortlist.
  const shortlist = pool
    .map((c) => ({ c, m: metricSim(target, c) }))
    .sort((a, b) => b.m - a.m)
    .slice(0, SHORTLIST);

  // Pass 2 — token-overlap refinement on the shortlist only.
  const sets = await tokenSets(admin, [target.address, ...shortlist.map((s) => s.c.address)]);
  const targetSet = sets.get(normalizeAddress(target.address)) ?? new Set<string>();

  const similar = shortlist
    .map(({ c, m }) => {
      const cSet = sets.get(normalizeAddress(c.address)) ?? new Set<string>();
      const overlap = jaccard(targetSet, cSet);
      const shared = Array.from(cSet).filter((x) => targetSet.has(x)).slice(0, 6);
      // Blend: metric shortlist score (0.7) + token overlap (0.3).
      const similarity = Math.round((m * 0.7 + overlap * 0.3) * 100);
      return {
        address: c.address, label: c.label, nakaNumber: c.naka_number ?? null, chain: c.chain, archetype: c.archetype,
        winRate: num(c.win_rate) != null ? Math.round(num(c.win_rate)!) : null,
        whaleScore: c.whale_score, verified: !!c.verified, logoUrl: c.logo_url,
        similarity, sharedTokens: shared,
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, RESULTS);

  return NextResponse.json({
    found: true,
    whale: {
      address: target.address, label: target.label, nakaNumber: target.naka_number ?? null, chain: target.chain, entityType: target.entity_type,
      archetype: target.archetype, verified: !!target.verified, logoUrl: target.logo_url,
      winRate: num(target.win_rate) != null ? Math.round(num(target.win_rate)!) : null,
      whaleScore: target.whale_score, pnl30dUsd: num(target.pnl_30d_usd), portfolioUsd: num(target.portfolio_value_usd),
      volume7dUsd: num(target.volume_7d_usd), trades30d: target.trade_count_30d, avgHoldHours: num(target.avg_hold_hours),
      topTokens: Array.from(targetSet).slice(0, 10),
    },
    similar,
  });
}
