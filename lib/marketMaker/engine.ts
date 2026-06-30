import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getDexPrice } from '@/lib/services/dexscreener';
import { getEvmTokenDecimals } from '@/lib/sniper/priceFeed';
import { usdcForChain } from '@/lib/trading/usdc';
import { aaChainFor } from '@/lib/wallet/sessionKeyAA';
import { tryExecuteSnipeViaSessionKey, tryExecuteSellViaSessionKey } from '@/lib/trading/sessionKeyExecutor';

/**
 * #68 Market-Maker engine (grid strategy, Phase 1).
 *
 * Non-custodial: every fill goes through the AA session-key executor, which is
 * bounded by the owner's signed per-trade + daily USD caps, the M2 min-output
 * floor and the M3 on-chain-balance cap. The engine layers per-strategy budget +
 * inventory guards on top and is conservative — at most one action per tick.
 * Strategies only run when status='active' AND the user has a funded kernel +
 * an active session key on that chain (otherwise the executor returns null and
 * the tick is a no-op). EVM only (AA is EVM); Solana strategies are persisted
 * but not auto-executed yet.
 *
 * Real data only — reference/market price comes from DexScreener; PnL is logged
 * from actual fills. Nothing is faked when a source or session is unavailable.
 */

export interface GridLevel {
  level: number;
  side: 'buy' | 'sell';
  targetPrice: number;
}

/**
 * Build a symmetric grid around a reference price: `numLevels` buy rungs below
 * and `numLevels` sell rungs above, spaced from spread_bps out to band_pct.
 */
export function computeLadder(
  reference: number,
  spreadBps: number,
  numLevels: number,
  bandPct: number,
): GridLevel[] {
  if (!(reference > 0) || numLevels < 1) return [];
  const halfSpread = spreadBps / 10_000;            // closest rung offset
  const band = Math.max(bandPct / 100, halfSpread); // furthest rung offset
  const levels: GridLevel[] = [];
  for (let i = 1; i <= numLevels; i++) {
    const t = numLevels === 1 ? 1 : i / numLevels;
    const offset = halfSpread + (band - halfSpread) * (t - 1 / numLevels);
    levels.push({ level: i, side: 'buy', targetPrice: reference * (1 - offset) });
    levels.push({ level: i, side: 'sell', targetPrice: reference * (1 + offset) });
  }
  return levels;
}

interface Strategy {
  id: string; user_id: string; chain: string; token_address: string;
  strategy_type: string; reference_price_mode: string; manual_reference_price: number | null;
  spread_bps: number; num_levels: number; order_size_usd: number; budget_usd: number;
  max_inventory_usd: number | null; max_slippage_bps: number; band_pct: number | null;
  range_lower_pct: number | null; range_upper_pct: number | null;
  status: string; realized_pnl_usd: number; inventory_tokens: number; spent_usd: number;
}

async function referencePrice(s: Strategy): Promise<number | null> {
  if (s.reference_price_mode === 'manual' && s.manual_reference_price) return s.manual_reference_price;
  const p = await getDexPrice(s.token_address).catch(() => 0);
  return p > 0 ? p : null;
}

export interface TickResult { id: string; action: 'buy' | 'sell' | 'hold' | 'skip'; reason?: string; txHash?: string; }

/** Run one tick for a single active strategy. Conservative: at most one fill. */
export async function runStrategyTick(s: Strategy): Promise<TickResult> {
  // AA execution is EVM-only; Solana strategies persist but don't auto-trade.
  if (!aaChainFor(s.chain)) return { id: s.id, action: 'skip', reason: 'chain not AA-executable yet' };
  // grid = symmetric ladder around reference; range = accumulate at/below a lower
  // bound, distribute at/above an upper bound. presence/CLMM are not auto-traded
  // (single-account self-trading is wash trading; CLMM needs LP-NFT mgmt + tests).
  if (s.strategy_type !== 'grid' && s.strategy_type !== 'range') {
    return { id: s.id, action: 'skip', reason: `${s.strategy_type} not auto-executed` };
  }
  const usdc = usdcForChain(s.chain);
  if (!usdc) return { id: s.id, action: 'skip', reason: 'no USDC for chain' };

  const ref = await referencePrice(s);
  if (!ref) return { id: s.id, action: 'skip', reason: 'no reference price' };
  const price = await getDexPrice(s.token_address).catch(() => 0);
  if (!(price > 0)) return { id: s.id, action: 'skip', reason: 'no market price' };

  const ladder = s.strategy_type === 'range'
    ? [
        { level: 1, side: 'buy' as const, targetPrice: ref * (1 + (s.range_lower_pct ?? -20) / 100) },
        { level: 1, side: 'sell' as const, targetPrice: ref * (1 + (s.range_upper_pct ?? 20) / 100) },
      ]
    : computeLadder(ref, s.spread_bps, s.num_levels, s.band_pct ?? 10);
  const sb = getSupabaseAdmin();
  const inventoryUsd = (s.inventory_tokens ?? 0) * price;

  // SELL side: price at/above the lowest sell rung and we hold inventory.
  const sellRung = ladder.filter((l) => l.side === 'sell' && price >= l.targetPrice).sort((a, b) => a.targetPrice - b.targetPrice)[0];
  if (sellRung && (s.inventory_tokens ?? 0) > 0) {
    const decimals = await getEvmTokenDecimals(s.chain, s.token_address).catch(() => 18);
    const tokensToSell = Math.min(s.order_size_usd / price, s.inventory_tokens);
    const baseUnits = BigInt(Math.floor(tokensToSell * 1e6)) * (BigInt(10) ** BigInt(decimals)) / BigInt(1e6);
    if (baseUnits > BigInt(0)) {
      const res = await tryExecuteSellViaSessionKey({
        userId: s.user_id, chain: s.chain, tokenAddress: s.token_address,
        tokenAmountBaseUnits: baseUnits.toString(), slippageBps: s.max_slippage_bps,
      }).catch(() => null);
      if (res?.txHash) {
        const proceedsUsd = tokensToSell * price;
        await sb.from('mm_fills').insert({ strategy_id: s.id, user_id: s.user_id, side: 'sell', price, amount_usd: proceedsUsd, amount_tokens: tokensToSell, tx_hash: res.txHash });
        await sb.from('mm_orders').insert({ strategy_id: s.id, user_id: s.user_id, level: sellRung.level, side: 'sell', target_price: sellRung.targetPrice, size_usd: proceedsUsd, status: 'filled', tx_hash: res.txHash, filled_at: new Date().toISOString() });
        await sb.from('mm_strategies').update({
          inventory_tokens: Math.max(0, s.inventory_tokens - tokensToSell),
          realized_pnl_usd: (s.realized_pnl_usd ?? 0) + proceedsUsd,
          spent_usd: Math.max(0, (s.spent_usd ?? 0) - proceedsUsd),
          last_run_at: new Date().toISOString(),
        }).eq('id', s.id);
        return { id: s.id, action: 'sell', txHash: res.txHash };
      }
    }
  }

  // BUY side: price at/below the highest buy rung, budget + inventory room left.
  const buyRung = ladder.filter((l) => l.side === 'buy' && price <= l.targetPrice).sort((a, b) => b.targetPrice - a.targetPrice)[0];
  if (buyRung) {
    if ((s.spent_usd ?? 0) + s.order_size_usd > s.budget_usd) return { id: s.id, action: 'hold', reason: 'budget exhausted' };
    if (s.max_inventory_usd != null && inventoryUsd >= s.max_inventory_usd) return { id: s.id, action: 'hold', reason: 'max inventory reached' };
    const res = await tryExecuteSnipeViaSessionKey({
      userId: s.user_id, chain: s.chain, tokenAddress: s.token_address,
      amountUsd: s.order_size_usd, slippageBps: s.max_slippage_bps,
    }).catch(() => null);
    if (res?.txHash) {
      const tokensBought = s.order_size_usd / price;
      await sb.from('mm_fills').insert({ strategy_id: s.id, user_id: s.user_id, side: 'buy', price, amount_usd: s.order_size_usd, amount_tokens: tokensBought, tx_hash: res.txHash });
      await sb.from('mm_orders').insert({ strategy_id: s.id, user_id: s.user_id, level: buyRung.level, side: 'buy', target_price: buyRung.targetPrice, size_usd: s.order_size_usd, status: 'filled', tx_hash: res.txHash, filled_at: new Date().toISOString() });
      await sb.from('mm_strategies').update({
        inventory_tokens: (s.inventory_tokens ?? 0) + tokensBought,
        spent_usd: (s.spent_usd ?? 0) + s.order_size_usd,
        last_run_at: new Date().toISOString(),
      }).eq('id', s.id);
      return { id: s.id, action: 'buy', txHash: res.txHash };
    }
    return { id: s.id, action: 'skip', reason: 'no session key / execution unavailable' };
  }

  return { id: s.id, action: 'hold', reason: 'price between rungs' };
}

/** Run all active strategies (engine cron). */
export async function runMarketMaker(limit = 50): Promise<{ active: number; results: TickResult[] }> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('mm_strategies')
    .select('*')
    .eq('status', 'active')
    .order('last_run_at', { ascending: true, nullsFirst: true })
    .limit(limit);
  const strategies = (data ?? []) as Strategy[];
  const results: TickResult[] = [];
  for (const s of strategies) {
    try { results.push(await runStrategyTick(s)); }
    catch (e) { results.push({ id: s.id, action: 'skip', reason: e instanceof Error ? e.message : 'tick error' }); }
  }
  return { active: strategies.length, results };
}
