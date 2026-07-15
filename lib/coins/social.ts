import 'server-only';

/**
 * Coins social layer - the parts unique to us: on-platform trade feed, holders
 * computed from real Naka trades (avg hold + PnL), thesis notes, and watchlist.
 * All reads/writes go through the service-role admin client; callers pass an
 * already-authenticated user id for writes.
 */

import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { tokenKeyFor } from './coinService';
import type { CoinTradeRow, CoinHolderRow } from './types';

interface ProfileLite {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface TradeRow {
  user_id: string;
  side: 'buy' | 'sell';
  usd_amount: number | string;
  token_amount: number | string;
  price_usd: number | string | null;
  market_cap_usd: number | string | null;
  tx_hash: string | null;
  created_at: string;
}

async function fetchProfiles(ids: string[]): Promise<Map<string, ProfileLite>> {
  const map = new Map<string, ProfileLite>();
  if (ids.length === 0) return map;
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', ids);
  for (const p of (data as ProfileLite[]) ?? []) map.set(p.id, p);
  return map;
}

/** On-platform trade feed for a coin (the "Feed" tab, platform side). */
export async function getPlatformTrades(
  chain: string,
  address: string,
  limit = 50,
): Promise<CoinTradeRow[]> {
  const tokenKey = tokenKeyFor(chain, address);
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('coin_trades')
    .select('user_id, side, usd_amount, token_amount, price_usd, market_cap_usd, tx_hash, created_at')
    .eq('chain', chain)
    .eq('token_key', tokenKey)
    .order('created_at', { ascending: false })
    .limit(limit);
  const rows = (data as TradeRow[]) ?? [];
  const profiles = await fetchProfiles([...new Set(rows.map((r) => r.user_id))]);
  return rows.map((r) => ({
    timestamp: Date.parse(r.created_at),
    side: r.side,
    usdAmount: Number(r.usd_amount) || 0,
    tokenAmount: Number(r.token_amount) || 0,
    priceUsd: Number(r.price_usd) || 0,
    marketCapUsd: r.market_cap_usd != null ? Number(r.market_cap_usd) : null,
    wallet: '',
    user: profiles.get(r.user_id) ?? null,
    source: 'platform' as const,
    txHash: r.tx_hash,
  }));
}

/**
 * Holders that bought via Naka, with real avg hold-time + PnL from their trade
 * history. usdValue is the live value of their net position at `currentPrice`.
 * Net-zero / net-negative positions are dropped (they've exited).
 */
export async function getPlatformHolders(
  chain: string,
  address: string,
  currentPrice: number | null,
  limit = 100,
): Promise<CoinHolderRow[]> {
  const tokenKey = tokenKeyFor(chain, address);
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('coin_trades')
    .select('user_id, side, usd_amount, token_amount, price_usd, market_cap_usd, tx_hash, created_at')
    .eq('chain', chain)
    .eq('token_key', tokenKey)
    .order('created_at', { ascending: true })
    .limit(5000);
  const rows = (data as TradeRow[]) ?? [];

  // Aggregate per user with a running-average basis so the holder PnL matches
  // the portfolio math, and scale the hold-time weighting down on sells so it
  // reflects the tokens still held rather than every token ever bought.
  interface Agg {
    netTokens: number;
    costTokens: number;
    costUsd: number;
    weightedHoldNumer: number; // Σ heldTokens_i * age_i
    weightedHoldDenom: number; // Σ heldTokens_i
  }
  const now = Date.now();
  const byUser = new Map<string, Agg>();
  for (const r of rows) {
    const a = byUser.get(r.user_id) ?? { netTokens: 0, costTokens: 0, costUsd: 0, weightedHoldNumer: 0, weightedHoldDenom: 0 };
    const tok = Number(r.token_amount) || 0;
    const usd = Number(r.usd_amount) || 0;
    const ts = Date.parse(r.created_at);
    if (r.side === 'buy') {
      a.netTokens += tok;
      a.costTokens += tok;
      a.costUsd += usd;
      a.weightedHoldNumer += tok * Math.max(0, now - ts);
      a.weightedHoldDenom += tok;
    } else {
      if (a.costTokens > 0) {
        const avg = a.costUsd / a.costTokens;
        const sold = Math.min(tok, a.costTokens);
        a.costTokens = Math.max(0, a.costTokens - tok);
        a.costUsd = Math.max(0, a.costUsd - sold * avg);
      }
      const before = a.netTokens;
      a.netTokens -= tok;
      if (before > 0) {
        const frac = Math.max(0, a.netTokens) / before;
        a.weightedHoldNumer *= frac;
        a.weightedHoldDenom *= frac;
      }
    }
    byUser.set(r.user_id, a);
  }

  const holders: Array<{ userId: string; usdValue: number; pnlPct: number | null; avgHoldMs: number | null }> = [];
  for (const [userId, a] of byUser) {
    if (a.netTokens <= 0.0000001) continue; // exited
    const avgBuyPrice = a.costTokens > 0 ? a.costUsd / a.costTokens : null;
    const usdValue = currentPrice != null ? a.netTokens * currentPrice : 0;
    const pnlPct = avgBuyPrice && avgBuyPrice > 0 && currentPrice != null ? ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100 : null;
    const avgHoldMs = a.weightedHoldDenom > 0 ? a.weightedHoldNumer / a.weightedHoldDenom : null;
    holders.push({ userId, usdValue, pnlPct, avgHoldMs });
  }
  holders.sort((x, y) => y.usdValue - x.usdValue);
  const top = holders.slice(0, limit);

  const profiles = await fetchProfiles(top.map((h) => h.userId));
  const thesisMap = await fetchThesisByUser(chain, tokenKey, top.map((h) => h.userId));

  return top
    .map((h) => {
      const p = profiles.get(h.userId);
      if (!p) return null;
      const t = thesisMap.get(h.userId);
      return {
        user: p,
        usdValue: h.usdValue,
        pnlPct: h.pnlPct,
        avgHoldMs: h.avgHoldMs,
        thesis: t ?? null,
      } as CoinHolderRow;
    })
    .filter((x): x is CoinHolderRow => x !== null);
}

interface ThesisRow {
  id: string;
  user_id: string;
  body: string;
  like_count: number;
  wire_post_id: string | null;
  created_at: string;
}

async function fetchThesisByUser(
  chain: string,
  tokenKey: string,
  userIds: string[],
): Promise<Map<string, { id: string; body: string; like_count: number; wire_post_id: string | null }>> {
  const map = new Map<string, { id: string; body: string; like_count: number; wire_post_id: string | null }>();
  if (userIds.length === 0) return map;
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('coin_thesis')
    .select('id, user_id, body, like_count, wire_post_id, created_at')
    .eq('chain', chain)
    .eq('token_key', tokenKey)
    .is('deleted_at', null)
    .in('user_id', userIds)
    .order('created_at', { ascending: false });
  for (const r of (data as ThesisRow[]) ?? []) {
    if (!map.has(r.user_id)) map.set(r.user_id, { id: r.id, body: r.body, like_count: r.like_count, wire_post_id: r.wire_post_id });
  }
  return map;
}

/** Record a settled trade into the platform feed + refresh the registry price. */
export async function recordTrade(params: {
  userId: string;
  chain: string;
  address: string;
  symbol?: string | null;
  side: 'buy' | 'sell';
  usdAmount: number;
  tokenAmount: number;
  priceUsd?: number | null;
  marketCapUsd?: number | null;
  txHash?: string | null;
}): Promise<{ id: string } | null> {
  const sb = getSupabaseAdmin();
  const tokenKey = tokenKeyFor(params.chain, params.address);
  const { data, error } = await sb
    .from('coin_trades')
    .insert({
      user_id: params.userId,
      chain: params.chain,
      token_key: tokenKey,
      token_address: params.address,
      symbol: params.symbol ?? null,
      side: params.side,
      usd_amount: params.usdAmount,
      token_amount: params.tokenAmount,
      price_usd: params.priceUsd ?? null,
      market_cap_usd: params.marketCapUsd ?? null,
      tx_hash: params.txHash ?? null,
    })
    .select('id')
    .maybeSingle();
  if (error) return null;
  return (data as { id: string }) ?? null;
}

/** The caller's own trades on one coin (time + side), for chart markers. */
export async function getMyCoinTrades(userId: string, chain: string, address: string): Promise<Array<{ time: number; side: 'buy' | 'sell' }>> {
  const sb = getSupabaseAdmin();
  const tokenKey = tokenKeyFor(chain, address);
  const { data } = await sb
    .from('coin_trades')
    .select('side, created_at')
    .eq('user_id', userId)
    .eq('chain', chain)
    .eq('token_key', tokenKey)
    .order('created_at', { ascending: true })
    .limit(200);
  return ((data as Array<{ side: 'buy' | 'sell'; created_at: string }>) ?? []).map((r) => ({ time: Math.floor(Date.parse(r.created_at) / 1000), side: r.side }));
}

// ─── Thesis ───────────────────────────────────────────────────────────────────

export async function getThesisFeed(chain: string, address: string, limit = 50): Promise<Array<{
  id: string; body: string; like_count: number; wire_post_id: string | null; created_at: string; user: ProfileLite | null;
}>> {
  const tokenKey = tokenKeyFor(chain, address);
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('coin_thesis')
    .select('id, user_id, body, like_count, wire_post_id, created_at')
    .eq('chain', chain)
    .eq('token_key', tokenKey)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  const rows = (data as ThesisRow[]) ?? [];
  const profiles = await fetchProfiles([...new Set(rows.map((r) => r.user_id))]);
  return rows.map((r) => ({
    id: r.id, body: r.body, like_count: r.like_count, wire_post_id: r.wire_post_id, created_at: r.created_at,
    user: profiles.get(r.user_id) ?? null,
  }));
}

export async function createThesis(userId: string, chain: string, address: string, body: string): Promise<{ id: string } | null> {
  const sb = getSupabaseAdmin();
  const tokenKey = tokenKeyFor(chain, address);
  const { data } = await sb
    .from('coin_thesis')
    .insert({ user_id: userId, chain, token_key: tokenKey, token_address: address, body })
    .select('id')
    .maybeSingle();
  return (data as { id: string }) ?? null;
}

export async function deleteThesis(userId: string, thesisId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from('coin_thesis').update({ deleted_at: new Date().toISOString() }).eq('id', thesisId).eq('user_id', userId);
}

/** Toggle a like on a thesis; returns the new like state + count. */
export async function toggleThesisLike(userId: string, thesisId: string): Promise<{ liked: boolean; like_count: number }> {
  const sb = getSupabaseAdmin();
  const { data: existing } = await sb.from('coin_thesis_likes').select('thesis_id').eq('thesis_id', thesisId).eq('user_id', userId).maybeSingle();
  if (existing) {
    await sb.from('coin_thesis_likes').delete().eq('thesis_id', thesisId).eq('user_id', userId);
  } else {
    await sb.from('coin_thesis_likes').insert({ thesis_id: thesisId, user_id: userId });
  }
  const { count } = await sb.from('coin_thesis_likes').select('thesis_id', { count: 'exact', head: true }).eq('thesis_id', thesisId);
  const like_count = count ?? 0;
  await sb.from('coin_thesis').update({ like_count }).eq('id', thesisId);
  return { liked: !existing, like_count };
}

// ─── Positions + trade statements (profile) ─────────────────────────────────────

export interface UserPosition {
  chain: string;
  tokenKey: string;
  tokenAddress: string;
  symbol: string | null;
  netTokens: number;
  buyTokens: number;
  buyCostUsd: number;
  realizedUsd: number;
  avgBuyPrice: number | null;
  firstBuyMs: number | null;
  lastTradeMs: number | null;
  tradeCount: number;
}

interface FullTradeRow extends TradeRow {
  chain: string;
  token_key: string;
  token_address: string;
  symbol: string | null;
}

/**
 * Aggregate a user's coin_trades into per-coin positions with cost basis and
 * realized PnL. Live value/unrealized PnL are layered on by the caller using
 * current prices, so this stays a pure DB rollup.
 */
export async function getUserPositions(userId: string, openOnly = false): Promise<UserPosition[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('coin_trades')
    .select('chain, token_key, token_address, symbol, side, usd_amount, token_amount, price_usd, market_cap_usd, tx_hash, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(10000);
  const rows = (data as FullTradeRow[]) ?? [];

  // Rows are time-ordered, so we carry a running-average cost basis per coin and
  // realize PnL at the moment of each sell. This matches the statement math and
  // does not let a buy made after a sale retroactively change realized PnL.
  interface Acc extends UserPosition { costTokens: number; costUsd: number }
  const byCoin = new Map<string, Acc>();
  for (const r of rows) {
    const key = `${r.chain}:${r.token_key}`;
    const p = byCoin.get(key) ?? {
      chain: r.chain, tokenKey: r.token_key, tokenAddress: r.token_address, symbol: r.symbol,
      netTokens: 0, buyTokens: 0, buyCostUsd: 0, realizedUsd: 0, avgBuyPrice: null,
      firstBuyMs: null, lastTradeMs: null, tradeCount: 0, costTokens: 0, costUsd: 0,
    };
    const tok = Number(r.token_amount) || 0;
    const usd = Number(r.usd_amount) || 0;
    const ts = Date.parse(r.created_at);
    p.tradeCount += 1;
    p.lastTradeMs = p.lastTradeMs == null ? ts : Math.max(p.lastTradeMs, ts);
    if (r.side === 'buy') {
      p.netTokens += tok; p.buyTokens += tok; p.buyCostUsd += usd;
      p.costTokens += tok; p.costUsd += usd;
      if (p.firstBuyMs == null || ts < p.firstBuyMs) p.firstBuyMs = ts;
    } else {
      // Only realize PnL against a known on-platform basis. Tokens sold without
      // a recorded buy (funded off-platform) are basis-unknown, not pure profit.
      if (p.costTokens > 0) {
        const avg = p.costUsd / p.costTokens;
        const sold = Math.min(tok, p.costTokens);
        p.realizedUsd += (usd * (sold / tok || 1)) - sold * avg;
        p.costTokens = Math.max(0, p.costTokens - tok);
        p.costUsd = Math.max(0, p.costUsd - sold * avg);
      }
      p.netTokens -= tok;
    }
    if (r.symbol) p.symbol = r.symbol;
    byCoin.set(key, p);
  }

  const out: UserPosition[] = [];
  for (const p of byCoin.values()) {
    // Basis of the open position is the remaining running average.
    const avgBuyPrice = p.costTokens > 0 ? p.costUsd / p.costTokens : (p.buyTokens > 0 ? p.buyCostUsd / p.buyTokens : null);
    if (openOnly && p.netTokens <= 0.0000001) continue;
    out.push({
      chain: p.chain, tokenKey: p.tokenKey, tokenAddress: p.tokenAddress, symbol: p.symbol,
      netTokens: p.netTokens, buyTokens: p.buyTokens, buyCostUsd: p.buyCostUsd,
      realizedUsd: p.realizedUsd, avgBuyPrice, firstBuyMs: p.firstBuyMs, lastTradeMs: p.lastTradeMs, tradeCount: p.tradeCount,
    });
  }
  out.sort((a, b) => (b.lastTradeMs ?? 0) - (a.lastTradeMs ?? 0));
  return out;
}

export interface DayStat { day: string; trades: number; volumeUsd: number; realizedUsd: number; wins: number; losses: number }

/**
 * Day-by-day trade statement for a month (YYYY-MM). Realized PnL per sell is
 * proceeds minus running-average cost, so wins/losses are honest.
 */
export async function getUserTradeStatement(userId: string, month: string): Promise<{
  month: string; days: DayStat[]; totals: { trades: number; volumeUsd: number; realizedUsd: number; wins: number; losses: number };
}> {
  const sb = getSupabaseAdmin();
  const start = `${month}-01T00:00:00.000Z`;
  const [y, m] = month.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  const end = `${nextMonth}-01T00:00:00.000Z`;
  const { data } = await sb
    .from('coin_trades')
    .select('chain, token_key, token_address, symbol, side, usd_amount, token_amount, price_usd, market_cap_usd, tx_hash, created_at')
    .eq('user_id', userId)
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: true })
    .limit(10000);
  const rows = (data as FullTradeRow[]) ?? [];

  // Running average cost per coin to attribute realized PnL to sell days.
  const cost = new Map<string, { tokens: number; usd: number }>();
  const byDay = new Map<string, DayStat>();
  for (const r of rows) {
    const key = `${r.chain}:${r.token_key}`;
    const day = r.created_at.slice(0, 10);
    const tok = Number(r.token_amount) || 0;
    const usd = Number(r.usd_amount) || 0;
    const d = byDay.get(day) ?? { day, trades: 0, volumeUsd: 0, realizedUsd: 0, wins: 0, losses: 0 };
    d.trades += 1;
    d.volumeUsd += usd;
    const c = cost.get(key) ?? { tokens: 0, usd: 0 };
    if (r.side === 'buy') {
      c.tokens += tok; c.usd += usd;
    } else if (c.tokens > 0) {
      // Realize only against a known basis; a sell of off-platform tokens is
      // basis-unknown and is not counted as a win or a loss.
      const avg = c.usd / c.tokens;
      const sold = Math.min(tok, c.tokens);
      const realized = (usd * (sold / tok || 1)) - sold * avg;
      d.realizedUsd += realized;
      if (realized >= 0) d.wins += 1; else d.losses += 1;
      c.tokens = Math.max(0, c.tokens - tok);
      c.usd = Math.max(0, c.usd - sold * avg);
    }
    cost.set(key, c);
    byDay.set(day, d);
  }
  const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  const totals = days.reduce(
    (acc, d) => ({ trades: acc.trades + d.trades, volumeUsd: acc.volumeUsd + d.volumeUsd, realizedUsd: acc.realizedUsd + d.realizedUsd, wins: acc.wins + d.wins, losses: acc.losses + d.losses }),
    { trades: 0, volumeUsd: 0, realizedUsd: 0, wins: 0, losses: 0 },
  );
  return { month, days, totals };
}

export interface TopTrade {
  user: ProfileLite;
  chain: string;
  tokenAddress: string;
  tokenKey: string;
  symbol: string | null;
  logoUrl: string | null;
  pnlUsd: number;
  pnlPct: number | null;
}

/**
 * Our own weekly leaderboard: the best-performing coin positions across the
 * platform over the last N days, from real trades (realized plus unrealized at
 * live registry prices). Positive results only, ranked by PnL. Empty when there
 * are no trades yet.
 */
export async function getTopTrades(days = 7, limit = 12): Promise<TopTrade[]> {
  const sb = getSupabaseAdmin();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await sb
    .from('coin_trades')
    .select('user_id, chain, token_key, token_address, symbol, side, usd_amount, token_amount, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(20000);
  const rows = (data as FullTradeRow[]) ?? [];
  if (rows.length === 0) return [];

  interface Agg { userId: string; chain: string; tokenKey: string; tokenAddress: string; symbol: string | null; net: number; costTokens: number; costUsd: number; realized: number; buyCost: number }
  const byKey = new Map<string, Agg>();
  for (const r of rows) {
    const key = `${r.user_id}:${r.chain}:${r.token_key}`;
    const a = byKey.get(key) ?? { userId: r.user_id, chain: r.chain, tokenKey: r.token_key, tokenAddress: r.token_address, symbol: r.symbol, net: 0, costTokens: 0, costUsd: 0, realized: 0, buyCost: 0 };
    const tok = Number(r.token_amount) || 0;
    const usd = Number(r.usd_amount) || 0;
    if (r.side === 'buy') { a.net += tok; a.costTokens += tok; a.costUsd += usd; a.buyCost += usd; }
    else {
      // Realize only against a known basis, so a pre-window or off-platform sell
      // does not book its full proceeds as profit and top the leaderboard.
      if (a.costTokens > 0) {
        const avg = a.costUsd / a.costTokens;
        const sold = Math.min(tok, a.costTokens);
        a.realized += (usd * (sold / tok || 1)) - sold * avg;
        a.costTokens = Math.max(0, a.costTokens - tok);
        a.costUsd = Math.max(0, a.costUsd - sold * avg);
      }
      a.net -= tok;
    }
    if (r.symbol) a.symbol = r.symbol;
    byKey.set(key, a);
  }

  const aggs = [...byKey.values()];
  const keys = [...new Set(aggs.map((a) => a.tokenKey))];
  const priceMap = new Map<string, { price: number | null; logo: string | null; symbol: string | null }>();
  if (keys.length) {
    const { data: reg } = await sb.from('coin_registry').select('chain, token_key, price_usd, logo_url, symbol').in('token_key', keys);
    for (const r of (reg as Array<Record<string, unknown>>) ?? []) priceMap.set(`${r.chain}:${r.token_key}`, { price: r.price_usd != null ? Number(r.price_usd) : null, logo: (r.logo_url as string) ?? null, symbol: (r.symbol as string) ?? null });
  }

  const scored = aggs.map((a) => {
    const meta = priceMap.get(`${a.chain}:${a.tokenKey}`);
    const price = meta?.price ?? null;
    const avg = a.costTokens > 0 ? a.costUsd / a.costTokens : null;
    const unrealized = price != null && a.net > 0 && avg != null ? a.net * (price - avg) : 0;
    const pnlUsd = a.realized + unrealized;
    const pnlPct = a.buyCost > 0 ? (pnlUsd / a.buyCost) * 100 : null;
    return { agg: a, pnlUsd, pnlPct, logo: meta?.logo ?? null, symbol: a.symbol ?? meta?.symbol ?? null };
  }).filter((s) => s.pnlUsd > 0).sort((x, y) => y.pnlUsd - x.pnlUsd).slice(0, limit);

  const profiles = await fetchProfiles([...new Set(scored.map((s) => s.agg.userId))]);
  return scored
    .map((s) => {
      const user = profiles.get(s.agg.userId);
      if (!user) return null;
      return { user, chain: s.agg.chain, tokenAddress: s.agg.tokenAddress, tokenKey: s.agg.tokenKey, symbol: s.symbol, logoUrl: s.logo, pnlUsd: s.pnlUsd, pnlPct: s.pnlPct } as TopTrade;
    })
    .filter((x): x is TopTrade => x !== null);
}

export interface TopTrader {
  user: ProfileLite;
  pnlUsd: number;
  tradeCount: number;
}

/**
 * Realized-plus-unrealized PnL leaderboard by trader: each account's PnL summed
 * across every coin it traded in the window, ranked by that total. Positive only.
 * When `followingOf` is passed we restrict to the accounts that user follows
 * (accepted follows), so the "friends" scope only ranks people they follow. Uses
 * the same running-average-at-sale basis as getTopTrades, so a pre-window or
 * off-platform sell is not booked as full profit. Empty when nothing qualifies.
 */
export async function getTopTraders(days = 7, limit = 25, followingOf?: string): Promise<TopTrader[]> {
  const sb = getSupabaseAdmin();

  // Friends scope: resolve who the caller follows first; no follows means an
  // honest empty leaderboard rather than the global one.
  let followingIds: string[] | null = null;
  if (followingOf) {
    const { data: follows } = await sb
      .from('social_follows')
      .select('following_id')
      .eq('follower_id', followingOf)
      .eq('status', 'accepted');
    followingIds = [...new Set(((follows as Array<{ following_id: string }>) ?? []).map((f) => f.following_id))];
    if (followingIds.length === 0) return [];
  }

  const since = new Date(Date.now() - days * 86400000).toISOString();
  let q = sb
    .from('coin_trades')
    .select('user_id, chain, token_key, token_address, symbol, side, usd_amount, token_amount, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(20000);
  if (followingIds) q = q.in('user_id', followingIds);
  const { data } = await q;
  const rows = (data as FullTradeRow[]) ?? [];
  if (rows.length === 0) return [];

  // Per (user, coin) running-average basis so realized PnL lines up with the
  // rest of the platform math; then rolled up to one number per user.
  interface Agg { userId: string; chain: string; tokenKey: string; net: number; costTokens: number; costUsd: number; realized: number; tradeCount: number }
  const byKey = new Map<string, Agg>();
  for (const r of rows) {
    const key = `${r.user_id}:${r.chain}:${r.token_key}`;
    const a = byKey.get(key) ?? { userId: r.user_id, chain: r.chain, tokenKey: r.token_key, net: 0, costTokens: 0, costUsd: 0, realized: 0, tradeCount: 0 };
    const tok = Number(r.token_amount) || 0;
    const usd = Number(r.usd_amount) || 0;
    a.tradeCount += 1;
    if (r.side === 'buy') { a.net += tok; a.costTokens += tok; a.costUsd += usd; }
    else {
      // Realize only against a known basis, matching getTopTrades.
      if (a.costTokens > 0) {
        const avg = a.costUsd / a.costTokens;
        const sold = Math.min(tok, a.costTokens);
        a.realized += (usd * (sold / tok || 1)) - sold * avg;
        a.costTokens = Math.max(0, a.costTokens - tok);
        a.costUsd = Math.max(0, a.costUsd - sold * avg);
      }
      a.net -= tok;
    }
    byKey.set(key, a);
  }

  const aggs = [...byKey.values()];
  const keys = [...new Set(aggs.map((a) => a.tokenKey))];
  const priceMap = new Map<string, number | null>();
  if (keys.length) {
    const { data: reg } = await sb.from('coin_registry').select('chain, token_key, price_usd').in('token_key', keys);
    for (const r of (reg as Array<Record<string, unknown>>) ?? []) priceMap.set(`${r.chain}:${r.token_key}`, r.price_usd != null ? Number(r.price_usd) : null);
  }

  // Sum realized plus live unrealized PnL across each user's coins.
  const byUser = new Map<string, { pnlUsd: number; tradeCount: number }>();
  for (const a of aggs) {
    const price = priceMap.get(`${a.chain}:${a.tokenKey}`) ?? null;
    const avg = a.costTokens > 0 ? a.costUsd / a.costTokens : null;
    const unrealized = price != null && a.net > 0 && avg != null ? a.net * (price - avg) : 0;
    const roll = byUser.get(a.userId) ?? { pnlUsd: 0, tradeCount: 0 };
    roll.pnlUsd += a.realized + unrealized;
    roll.tradeCount += a.tradeCount;
    byUser.set(a.userId, roll);
  }

  const scored = [...byUser.entries()]
    .map(([userId, r]) => ({ userId, pnlUsd: r.pnlUsd, tradeCount: r.tradeCount }))
    .filter((s) => s.pnlUsd > 0)
    .sort((x, y) => y.pnlUsd - x.pnlUsd)
    .slice(0, limit);

  const profiles = await fetchProfiles([...new Set(scored.map((s) => s.userId))]);
  return scored
    .map((s) => {
      const user = profiles.get(s.userId);
      if (!user) return null;
      return { user, pnlUsd: s.pnlUsd, tradeCount: s.tradeCount } as TopTrader;
    })
    .filter((x): x is TopTrader => x !== null);
}

// ─── Watchlist ─────────────────────────────────────────────────────────────────

export async function getWatchlistKeys(userId: string): Promise<Set<string>> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('coin_watchlist').select('chain, token_key').eq('user_id', userId);
  const set = new Set<string>();
  for (const r of (data as Array<{ chain: string; token_key: string }>) ?? []) set.add(`${r.chain}:${r.token_key}`);
  return set;
}

export async function addWatch(userId: string, chain: string, address: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from('coin_watchlist').upsert(
    { user_id: userId, chain, token_key: tokenKeyFor(chain, address), token_address: address },
    { onConflict: 'user_id,chain,token_key' },
  );
}

export async function removeWatch(userId: string, chain: string, address: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from('coin_watchlist').delete().eq('user_id', userId).eq('chain', chain).eq('token_key', tokenKeyFor(chain, address));
}
