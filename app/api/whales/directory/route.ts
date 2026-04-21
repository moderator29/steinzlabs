import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { cacheWithFallback } from '@/lib/cache/redis';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';

// Phase 6 — pro-grade whale directory, powers the Nansen/Arkham-style directory UI.
// Returns ranked whale entities with aggregate stats. All filters + sorts are server-side.

export const runtime = 'nodejs';

// §2.10 — performance pill maps to one of these. pnl_30d_asc = Top
// Losers (sort ascending). trade_count = Most Active.
type SortKey = 'score' | 'portfolio' | 'pnl_30d' | 'pnl_30d_asc' | 'win_rate' | 'recent_activity' | 'trade_count';

const SORT_COLUMN: Record<SortKey, string> = {
  score: 'whale_score',
  portfolio: 'portfolio_value_usd',
  pnl_30d: 'pnl_30d_usd',
  pnl_30d_asc: 'pnl_30d_usd',
  win_rate: 'win_rate',
  recent_activity: 'last_active_at',
  trade_count: 'trade_count_30d',
};

const SORT_ASCENDING = new Set<SortKey>(['pnl_30d_asc']);

export const GET = withTierGate('pro', async (request: NextRequest) => {
  const sp = request.nextUrl.searchParams;
  const chain = sp.get('chain') || '';
  const entityType = sp.get('entity_type') || '';
  const q = (sp.get('q') || '').trim();
  const sort = (sp.get('sort') || 'score') as SortKey;
  const minScore = parseInt(sp.get('min_score') || '0', 10) || 0;
  const minPortfolioUsd = parseInt(sp.get('min_portfolio_usd') || '0', 10) || 0;
  const offset = Math.max(0, parseInt(sp.get('offset') || '0', 10) || 0);
  const limit = Math.max(1, Math.min(60, parseInt(sp.get('limit') || '24', 10) || 24));

  const cacheKey = `whales:dir:${chain}:${entityType}:${q}:${sort}:${minScore}:${minPortfolioUsd}:${offset}:${limit}`;

  try {
    const data = await cacheWithFallback(cacheKey, 20, async () => {
      const supabase = getSupabaseAdmin();
      const column = SORT_COLUMN[sort] || 'whale_score';
      const ascending = SORT_ASCENDING.has(sort);
      let query = supabase
        .from('whales')
        .select(
          'id, address, chain, label, entity_type, archetype, portfolio_value_usd, pnl_30d_usd, win_rate, whale_score, trade_count_30d, avg_hold_hours, follower_count, x_handle, tg_handle, website, verified, last_active_at, first_seen_at',
          { count: 'exact' },
        )
        .eq('is_active', true)
        .order(column, { ascending, nullsFirst: false })
        .range(offset, offset + limit - 1);

      if (chain) query = query.eq('chain', chain);
      if (entityType) query = query.eq('entity_type', entityType);
      if (minScore > 0) query = query.gte('whale_score', minScore);
      if (minPortfolioUsd > 0) query = query.gte('portfolio_value_usd', minPortfolioUsd);
      if (q) query = query.or(`label.ilike.%${q}%,address.ilike.%${q}%`);

      const { data, error, count } = await query;
      if (error) throw error;

      // Aggregate totals (separate query, cheap).
      const { data: agg } = await supabase
        .from('whales')
        .select('entity_type, chain')
        .eq('is_active', true);
      const byEntity: Record<string, number> = {};
      const byChain: Record<string, number> = {};
      (agg ?? []).forEach((r) => {
        byEntity[r.entity_type] = (byEntity[r.entity_type] || 0) + 1;
        byChain[r.chain] = (byChain[r.chain] || 0) + 1;
      });

      return {
        whales: data ?? [],
        total: count ?? 0,
        offset,
        limit,
        facets: { byEntity, byChain },
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error('[api/whales/directory]', err);
    return NextResponse.json({ error: 'Failed to load directory' }, { status: 500 });
  }
});
