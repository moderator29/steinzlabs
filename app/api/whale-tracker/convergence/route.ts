import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cacheWithFallback } from '@/lib/cache/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Convergence Radar — the ranked "smart money is converging here" board.
//
// Unlike /api/intelligence/convergence (a symbol-keyed lookup for feed badges),
// this returns the full ENRICHED, RANKED board for the Convergence Radar page:
//   - reputation-weighted: each convergence is scored by the win-rate/archetype
//     of the SPECIFIC whales that converged (joined from the whales table), so
//     5 proven winners outrank 8 random wallets.
//   - alpha-focused: stablecoins + wrapped majors are demoted (whales parking
//     in USDC/WBTC isn't a trade signal), surfacing genuine small/mid-cap
//     accumulation.
//   - earliness-aware: fresher first-detections rank higher (catch it early).
// All real data — smart_money_convergence (fixed to upsert, one row/token) +
// whales. No fabrication.

// Stablecoins + wrapped majors = noise for a convergence signal. Demoted, not
// hidden (a filter toggle can show them).
const NOISE_SYMBOLS = new Set([
  'USDC', 'USDT', 'DAI', 'TUSD', 'USDE', 'FRAX', 'BUSD', 'USDD', 'GUSD', 'LUSD', 'PYUSD', 'FDUSD',
  'WBTC', 'WETH', 'WBNB', 'WSOL', 'STETH', 'WSTETH', 'CBETH', 'RETH', 'WAVAX', 'WMATIC',
]);

interface WhaleRow {
  address: string;
  label: string | null;
  archetype: string | null;
  win_rate: number | null;
  pnl_30d_usd: number | null;
  whale_score: number | null;
}

interface ConvergenceRow {
  id: string;
  token_address: string;
  token_symbol: string | null;
  chain: string;
  wallet_count: number | null;
  wallets: string[] | null;
  total_value_usd: number | null;
  detected_at: string;
  last_refreshed_at: string | null;
  is_active: boolean;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const chain = (sp.get('chain') ?? '').trim().toLowerCase() || null;
  const includeNoise = sp.get('includeNoise') === '1';
  const limit = Math.min(60, Math.max(1, parseInt(sp.get('limit') ?? '40', 10) || 40));

  const cacheKey = `conv-radar:${chain ?? 'all'}:${includeNoise ? 'all' : 'alpha'}:${limit}`;
  try {
    const data = await cacheWithFallback(cacheKey, 30, async () => {
      const sb = getSupabaseAdmin();
      let q = sb
        .from('smart_money_convergence')
        .select('id, token_address, token_symbol, chain, wallet_count, wallets, total_value_usd, detected_at, last_refreshed_at, is_active')
        .eq('is_active', true)
        .order('wallet_count', { ascending: false })
        .limit(120);
      if (chain) q = q.eq('chain', chain);
      const { data: rows, error } = await q;
      if (error) throw error;
      const convergences = (rows ?? []) as ConvergenceRow[];
      if (convergences.length === 0) return { convergences: [], refreshedAt: new Date().toISOString() };

      // Batch-load the reputation of every whale involved across all rows.
      const allAddrs = Array.from(new Set(
        convergences.flatMap((c) => (c.wallets ?? []).map((a) => a.toLowerCase())),
      ));
      const whaleMap = new Map<string, WhaleRow>();
      if (allAddrs.length) {
        // Supabase .in caps around a few hundred; chunk to be safe.
        for (let i = 0; i < allAddrs.length; i += 300) {
          const chunk = allAddrs.slice(i, i + 300);
          const { data: whales } = await sb
            .from('whales')
            .select('address, label, archetype, win_rate, pnl_30d_usd, whale_score')
            .in('address', chunk);
          for (const w of (whales ?? []) as WhaleRow[]) {
            whaleMap.set((w.address || '').toLowerCase(), w);
          }
        }
      }

      const now = Date.now();
      const enriched = convergences.map((c) => {
        const addrs = (c.wallets ?? []).map((a) => a.toLowerCase());
        const whales = addrs.map((a) => whaleMap.get(a)).filter(Boolean) as WhaleRow[];
        const winRates = whales.map((w) => w.win_rate).filter((v): v is number => typeof v === 'number' && v > 0);
        const avgWinRate = winRates.length ? winRates.reduce((s, v) => s + v, 0) / winRates.length : null;
        const scores = whales.map((w) => w.whale_score).filter((v): v is number => typeof v === 'number');
        const avgWhaleScore = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : null;
        // Top archetype among the converging wallets.
        const archCount: Record<string, number> = {};
        for (const w of whales) if (w.archetype) archCount[w.archetype] = (archCount[w.archetype] ?? 0) + 1;
        const topArchetype = Object.entries(archCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        const namedWhales = whales
          .filter((w) => w.label)
          .slice(0, 4)
          .map((w) => ({ address: w.address, label: w.label, winRate: w.win_rate, archetype: w.archetype }));

        const sym = (c.token_symbol ?? '').toUpperCase();
        const isNoise = NOISE_SYMBOLS.has(sym);
        const ageHours = (now - new Date(c.detected_at).getTime()) / 3_600_000;
        // Alpha score: wallet count (log-damped) × reputation × earliness, with
        // stables/majors heavily demoted. Purely a ranking heuristic over real
        // inputs — never presented as a price target.
        const countFactor = Math.log2((c.wallet_count ?? 2) + 1);        // 2→1.58, 8→3.17
        const repFactor = avgWinRate != null ? 0.5 + avgWinRate / 100 : 0.75; // 0.5–1.5
        const earlyFactor = ageHours < 6 ? 1.4 : ageHours < 24 ? 1.15 : ageHours < 72 ? 1 : 0.8;
        const noiseFactor = isNoise ? 0.1 : 1;
        const alphaScore = Math.round(countFactor * repFactor * earlyFactor * noiseFactor * 100) / 10;

        return {
          id: c.id,
          tokenSymbol: c.token_symbol,
          tokenAddress: c.token_address,
          chain: c.chain,
          walletCount: c.wallet_count ?? 0,
          totalValueUsd: Number(c.total_value_usd ?? 0),
          firstSeen: c.detected_at,
          ageHours: Math.round(ageHours * 10) / 10,
          lastRefreshedAt: c.last_refreshed_at,
          avgWinRate: avgWinRate != null ? Math.round(avgWinRate) : null,
          avgWhaleScore: avgWhaleScore != null ? Math.round(avgWhaleScore) : null,
          topArchetype,
          namedWhales,
          isNoise,
          alphaScore,
        };
      });

      const filtered = includeNoise ? enriched : enriched.filter((e) => !e.isNoise);
      filtered.sort((a, b) => b.alphaScore - a.alphaScore);
      return { convergences: filtered.slice(0, limit), refreshedAt: new Date().toISOString() };
    });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'private, max-age=30' } });
  } catch (err) {
    console.error('[whale-tracker/convergence]', err);
    return NextResponse.json({ convergences: [], error: 'convergence_unavailable' }, { status: 502 });
  }
}
