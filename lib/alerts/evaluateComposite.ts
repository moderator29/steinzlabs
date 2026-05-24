import 'server-only';
import { cacheGet } from '@/lib/cache/redis';

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

async function evaluatePredicate(p: PredicateNode): Promise<boolean | null> {
  switch (p.type) {
    case 'price': {
      if (p.threshold == null) return false;
      const live = await priceOf(p.symbol, p.token_id);
      if (live == null) return null;            // cold cache → don't fire
      return p.direction === 'below' ? live <= p.threshold : live >= p.threshold;
    }
    // Other predicate types (velocity / whale_buy / market_cap_* /
    // deployer_band) require data surfaces the alert-monitor cron does
    // not yet stream in. Returning null (cold) keeps the alert dormant
    // instead of firing on fabricated truth — when those surfaces wire
    // in, replace the null with a real read.
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
