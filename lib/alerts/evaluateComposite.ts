import 'server-only';
import { cacheGet } from '@/lib/cache/redis';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Composite alert expression evaluator. The expression is a JSON tree:
 *   { op: 'AND'|'OR', children: [<expr>|<predicate>] }
 * A leaf predicate is { type, ...params }; recognized types come from
 * VALID_PREDICATE_TYPES in /api/alerts/composite/route.ts.
 *
 * Returns null when ANY referenced data source is cold (no live price,
 * no LunarCrush row, no whale tx). Cold-data must NOT fire — the
 * locked rule is no fabricated truth. The caller treats null as
 * "do not fire, do not update last_triggered_at".
 */

interface CachedPrice { id?: string; symbol?: string; price?: number; change24h?: number; fetchedAt?: number; }

interface PredicateNode {
  type: string;
  symbol?: string;
  token_id?: string;
  direction?: 'above' | 'below';
  threshold?: number;
  threshold_pct?: number;
  hours?: number;
  whale_address?: string;
  min_usd?: number;
  action?: 'buy' | 'sell';
  cohort?: string;
  band?: string;
  threshold_usd?: number;
  platform?: string;
}

interface OpNode { op: 'AND' | 'OR'; children: Array<OpNode | PredicateNode>; }

type Node = OpNode | PredicateNode;

function isOp(n: Node): n is OpNode { return (n as OpNode).op !== undefined; }

async function priceOf(symbol?: string, tokenId?: string): Promise<number | null> {
  if (tokenId) {
    const v = await cacheGet<CachedPrice>(`price:cg:${tokenId}`);
    if (v?.price != null) return v.price;
  }
  if (symbol) {
    const v = await cacheGet<CachedPrice>(`price:sym:${symbol.toLowerCase()}`);
    if (v?.price != null) return v.price;
  }
  return null;
}

// 24h % change from the same cached price rows (null = cold, don't fire).
async function change24hOf(symbol?: string, tokenId?: string): Promise<number | null> {
  if (tokenId) {
    const v = await cacheGet<CachedPrice>(`price:cg:${tokenId}`);
    if (v?.change24h != null) return v.change24h;
  }
  if (symbol) {
    const v = await cacheGet<CachedPrice>(`price:sym:${symbol.toLowerCase()}`);
    if (v?.change24h != null) return v.change24h;
  }
  return null;
}

// A recent whale action from the live whale_activity surface. Returns
// true/false (absence of a matching trade is a real "no", not cold), or null
// only when the query itself fails.
async function whaleActionMet(p: PredicateNode, action: 'buy' | 'sell'): Promise<boolean | null> {
  if (!p.whale_address) return false;
  const hours = p.hours && p.hours > 0 ? p.hours : 24;
  const sinceIso = new Date(Date.now() - hours * 3_600_000).toISOString();
  // whale_activity stores buys as 'buy'/'transfer_in', sells as
  // 'sell'/'transfer_out'. Match either alias for the requested side.
  const actions = action === 'buy' ? ['buy', 'transfer_in'] : ['sell', 'transfer_out'];
  try {
    let q = getSupabaseAdmin()
      .from('whale_activity')
      .select('value_usd')
      .ilike('whale_address', p.whale_address)
      .gte('timestamp', sinceIso)
      .in('action', actions)
      .limit(1);
    if (p.min_usd != null) q = q.gte('value_usd', p.min_usd);
    const { data, error } = await q;
    if (error) return null;
    return (data?.length ?? 0) > 0;
  } catch {
    return null;
  }
}

async function evaluatePredicate(p: PredicateNode): Promise<boolean | null> {
  switch (p.type) {
    case 'price': {
      if (p.threshold == null) return false;
      const live = await priceOf(p.symbol, p.token_id);
      if (live == null) return null;            // cold cache → don't fire
      return p.direction === 'below' ? live <= p.threshold : live >= p.threshold;
    }
    case 'velocity': {
      // 24h price momentum. threshold_pct + direction (above/below).
      const pct = p.threshold_pct ?? p.threshold;
      if (pct == null) return false;
      const change = await change24hOf(p.symbol, p.token_id);
      if (change == null) return null;          // cold change data → don't fire
      return p.direction === 'below' ? change <= pct : change >= pct;
    }
    case 'whale_buy':
      return whaleActionMet(p, 'buy');
    case 'whale_action':
      return whaleActionMet(p, p.action === 'sell' ? 'sell' : 'buy');
    // market_cap_* and deployer_band still require live surfaces the cron does
    // not stream. Returning null (cold) keeps the alert dormant rather than
    // firing on fabricated truth — wire a real read here when they land.
    default:
      return null;
  }
}

export async function evaluateExpression(node: unknown): Promise<boolean | null> {
  if (!node || typeof node !== 'object') return false;
  const n = node as Node;
  if (isOp(n)) {
    if (!Array.isArray(n.children) || n.children.length === 0) return false;
    if (n.op === 'AND') {
      let anyCold = false;
      for (const c of n.children) {
        const r = await evaluateExpression(c);
        if (r === false) return false;
        if (r === null) anyCold = true;
      }
      return anyCold ? null : true;
    }
    if (n.op === 'OR') {
      let allCold = true;
      for (const c of n.children) {
        const r = await evaluateExpression(c);
        if (r === true) return true;
        if (r === false) allCold = false;
      }
      return allCold ? null : false;
    }
    return false;
  }
  return evaluatePredicate(n);
}
