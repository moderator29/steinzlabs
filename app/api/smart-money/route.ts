import 'server-only';
import { NextResponse } from 'next/server';
import { searchPairs } from '@/lib/services/dexscreener';
import type { DexPair } from '@/lib/services/dexscreener';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;

export type WalletArchetype = 'DIAMOND_HANDS' | 'SCALPER' | 'DEGEN' | 'WHALE_FOLLOWER' | 'HOLDER' | 'INACTIVE' | 'NEW_WALLET';

export interface SmartWallet {
  id: string;
  address: string;
  shortAddress: string;
  name: string;
  totalVolume: number;
  totalVolumeStr: string;
  recentTrades: SmartTrade[];
  chain: string;
  chains: string[];
  lastActive: string;
  rank: number;
  tags: string[];
  // null = win rate genuinely unknown for this wallet (e.g. derived from raw
  // transfer/pair data with no trade-outcome history). The UI renders "—",
  // never a misleading "0%".
  winRate: number | null;
  pnl: string;
  pnlChange: number;
  trades: number;
  avgHold: string;
  bestTrade: string;
  archetype: WalletArchetype;
  weeklyPnlChange: number; // % change vs prior week
  isRiser: boolean;        // top mover this week
  // Dune-sourced smart-money score (0-100), when the wallet is in the
  // dune_smart_money_score surface. Independent, on-chain-derived signal shown
  // alongside our own whale_score.
  duneScore?: number | null;
}

export interface ConvergenceSignal {
  token: string; symbol: string; walletCount: number; totalVolume: string; timeWindow: string;
}

function detectArchetype(winRate: number, trades: number, pnlChange: number, avgHold: string): WalletArchetype {
  const holdDays = parseInt(avgHold) || 1;
  if (trades === 0) return 'INACTIVE';
  if (trades < 5) return 'NEW_WALLET';
  if (holdDays >= 30 && winRate >= 60) return 'DIAMOND_HANDS';
  if (holdDays <= 1 && trades >= 50) return 'SCALPER';
  if (pnlChange > 50 || (winRate < 45 && trades > 20)) return 'DEGEN';
  if (holdDays <= 3 && winRate >= 55) return 'WHALE_FOLLOWER';
  if (holdDays >= 7) return 'HOLDER';
  return 'DEGEN';
}

export interface SmartTrade {
  action: string;
  token: string;
  amount: string;
  time: string;
  chain: string;
  wallet?: string;
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(timestamp: string | number): string {
  const now = Date.now();
  const then = typeof timestamp === 'string' ? new Date(timestamp).getTime() : Number(timestamp);
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatVolume(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

const KNOWN_LABELS: Record<string, string> = {
  '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance Hot',
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': 'Binance 14',
  '0x974caa59e49682cda0ad2bbe82983419a2ecc400': 'Coinbase',
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': 'Coinbase Prime',
  '0xf977814e90da44bfa03b6295a0616a897441acec': 'Binance 8',
  '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503': 'Binance 15',
};

async function getWalletsFromAlchemy(): Promise<SmartWallet[]> {
  if (!ALCHEMY_KEY) return [];

  try {
    const blockRes = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      signal: AbortSignal.timeout(8000),
    });
    const blockData = await blockRes.json();
    const latestBlock = parseInt(blockData.result, 16);
    const fromBlock = '0x' + (latestBlock - 200).toString(16);

    const transferRes = await fetch(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromBlock,
          toBlock: 'latest',
          category: ['external', 'erc20'],
          order: 'desc',
          maxCount: '0x64',
          withMetadata: true,
        }],
      }),
      signal: AbortSignal.timeout(10000),
    });

    const transferData = await transferRes.json();
    const transfers = transferData.result?.transfers || [];

    // Filter large transfers (>= 50 ETH equivalent or large ERC20 amounts)
    const large = transfers.filter((tx: any) => (tx.value || 0) >= 50);

    // Group by sender address to build wallet profiles
    const walletMap = new Map<string, { address: string; trades: any[]; totalVolume: number }>();

    for (const tx of large) {
      const addr = tx.from as string;
      if (!addr) continue;
      if (!walletMap.has(addr)) {
        walletMap.set(addr, { address: addr, trades: [], totalVolume: 0 });
      }
      const entry = walletMap.get(addr)!;
      entry.trades.push(tx);
      entry.totalVolume += tx.value || 0;
    }

    // Sort by volume, take top 10
    const sorted = Array.from(walletMap.values())
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 10);

    return sorted.map((w, i) => {
      const label = KNOWN_LABELS[w.address.toLowerCase()] || `Whale ${i + 1}`;
      const recentTrades: SmartTrade[] = w.trades.slice(0, 3).map((tx: any) => ({
        action: 'Transfer',
        token: tx.asset || 'ETH',
        amount: formatVolume(tx.value * 2500), // rough ETH price
        time: tx.metadata?.blockTimestamp ? timeAgo(tx.metadata.blockTimestamp) : 'recent',
        chain: 'ETH',
      }));

      const volumeUsd = w.totalVolume * 2500; // rough ETH price
      return {
        id: w.address,
        address: w.address,
        shortAddress: shortenAddress(w.address),
        name: label,
        totalVolume: volumeUsd,
        totalVolumeStr: formatVolume(volumeUsd),
        recentTrades,
        chain: 'Ethereum',
        chains: ['ETH'],
        lastActive: w.trades[0]?.metadata?.blockTimestamp
          ? timeAgo(w.trades[0].metadata.blockTimestamp)
          : 'recent',
        rank: i + 1,
        tags: label.includes('Binance') || label.includes('Coinbase') ? ['CEX', 'Exchange'] : ['Whale', 'DeFi'],
        winRate: null,   // unknown: raw transfer history carries no trade outcomes
        pnl: 'N/A',
        pnlChange: 0,
        trades: w.trades.length,
        avgHold: 'Unknown',
        bestTrade: formatVolume(Math.max(...w.trades.map((t: any) => (t.value ?? 0) * 2500))),
        archetype: detectArchetype(0, w.trades.length, 0, 'unknown'),
        weeklyPnlChange: 0,
        isRiser: false,
      };
    });
  } catch (err) {

    return [];
  }
}

async function getWalletsFromDexScreener(): Promise<SmartWallet[]> {
  try {
    const queries = ['ethereum', 'sol', 'bitcoin'];
    const results = await Promise.allSettled(queries.map(q => searchPairs(q)));

    const allPairs: DexPair[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') allPairs.push(...result.value);
    }

    const highVolumePairs = allPairs
      .filter(p => (p.volume?.h24 ?? 0) > 500000)
      .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
      .slice(0, 20);

    if (highVolumePairs.length === 0) return [];

    const wallets: SmartWallet[] = highVolumePairs.slice(0, 10).map((pair: DexPair, i: number) => {
      const volume24h = pair.volume?.h24 || 0;
      const priceChange = pair.priceChange?.h24 || 0;
      const isBuy = priceChange > 0;
      const chain = pair.chainId || 'ethereum';
      const chainLabel = chain === 'solana' ? 'SOL' :
        chain === 'ethereum' ? 'ETH' :
        chain === 'bsc' ? 'BSC' :
        chain === 'base' ? 'BASE' :
        chain.toUpperCase().slice(0, 4);

      const address = pair.pairAddress || pair.baseToken?.address || '';
      const tokenSymbol = pair.baseToken?.symbol || 'TOKEN';
      const quoteSymbol = pair.quoteToken?.symbol || 'USD';

      const recentTrades: SmartTrade[] = [
        {
          action: isBuy ? 'Bought' : 'Sold',
          token: tokenSymbol,
          amount: formatVolume(volume24h * 0.3),
          time: '< 1h ago',
          chain: chainLabel,
        },
        {
          action: 'Swap',
          token: `${tokenSymbol}/${quoteSymbol}`,
          amount: formatVolume(volume24h * 0.2),
          time: '2h ago',
          chain: chainLabel,
        },
      ];

      const txns24h = (pair.txns.h24?.buys || 0) + (pair.txns.h24?.sells || 0);
      const tags = [chainLabel];
      if (volume24h > 5e6) tags.push('High Vol');
      if (Math.abs(priceChange) > 10) tags.push('Volatile');
      if (txns24h > 1000) tags.push('Active');

      return {
        id: address,
        address,
        shortAddress: shortenAddress(address),
        name: `${tokenSymbol} Market Maker`,
        totalVolume: volume24h,
        totalVolumeStr: formatVolume(volume24h),
        recentTrades,
        chain: pair.chainId || 'ethereum',
        chains: [chainLabel],
        lastActive: '< 1h ago',
        rank: i + 1,
        tags,
        winRate: null,   // unknown: pair data carries no per-wallet trade outcomes
        pnl: priceChange !== 0 ? `${priceChange >= 0 ? '+' : ''}${formatVolume(volume24h * Math.abs(priceChange) / 100)}` : 'N/A',
        pnlChange: parseFloat(priceChange.toFixed(1)),
        trades: txns24h,
        avgHold: '6h',
        bestTrade: formatVolume(volume24h * 0.15),
        archetype: detectArchetype(0, txns24h, parseFloat(priceChange.toFixed(1)), '6h'),
        weeklyPnlChange: 0,
        isRiser: i < 3 && priceChange > 5,
      };
    });

    return wallets;
  } catch { return []; }
}

async function getRecentMovesFromDexScreener(): Promise<SmartTrade[]> {
  try {
    const pairs = (await searchPairs('sol'))
      .filter(p => (p.volume?.h1 ?? 0) > 10000)
      .sort((a, b) => (b.volume?.h1 || 0) - (a.volume?.h1 || 0))
      .slice(0, 8);

    return pairs.map(pair => {
      const priceChange = pair.priceChange?.h1 || 0;
      const chain = pair.chainId === 'solana' ? 'SOL' : pair.chainId === 'ethereum' ? 'ETH' : pair.chainId?.toUpperCase().slice(0, 4) || 'MULTI';
      return {
        wallet: shortenAddress(pair.pairAddress || '0x???'),
        action: priceChange > 0 ? 'Bought' : 'Sold',
        token: pair.baseToken?.symbol || 'TOKEN',
        amount: formatVolume(pair.volume?.h1 || 0),
        time: '< 1h ago',
        chain,
      };
    });
  } catch { return []; }
}

// ─── Primary source: the real curated `whales` dataset ─────────────────────
//
// The Alchemy/DexScreener derivations below have NO trade-outcome history, so
// they can't produce a real win rate or P&L (they hardcoded 0, which surfaced
// as a misleading "0% Win" on every card). The `whales` table is the platform's
// curated smart-money dataset — 550+ wallets with real win_rate, whale_score,
// realized P&L, archetype and hold time, refreshed by the metrics cron. Prefer
// it; the raw-derivation path only runs if the table is somehow empty.

const CHAIN_LABEL: Record<string, string> = {
  ethereum: 'ETH', solana: 'SOL', bsc: 'BSC', base: 'BASE',
  arbitrum: 'ARB', optimism: 'OP', polygon: 'MATIC', avalanche: 'AVAX', ton: 'TON',
};

// Map the whales table's free-text archetype to the UI enum. Unknown text
// falls through to the heuristic detector so the badge is always populated.
function normalizeArchetype(text: string | null, winRate: number, trades: number, pnlChange: number, avgHold: string): WalletArchetype {
  const t = (text ?? '').toLowerCase();
  if (t.includes('diamond')) return 'DIAMOND_HANDS';
  if (t.includes('scalp')) return 'SCALPER';
  if (t.includes('degen')) return 'DEGEN';
  if (t.includes('follow')) return 'WHALE_FOLLOWER';
  if (t.includes('hold') || t.includes('treasury') || t.includes('institution') || t.includes('fund')) return 'HOLDER';
  if (t.includes('inactive')) return 'INACTIVE';
  if (t.includes('new')) return 'NEW_WALLET';
  return detectArchetype(winRate, trades, pnlChange, avgHold);
}

function formatHold(hours: number | null): string {
  if (hours == null || !isFinite(hours) || hours <= 0) return 'Unknown';
  if (hours >= 24) return `${Math.round(hours / 24)}d`;
  return `${Math.round(hours)}h`;
}

function signedUsd(v: number): string {
  const sign = v >= 0 ? '+' : '-';
  return `${sign}${formatVolume(Math.abs(v))}`;
}

interface WhaleRow {
  address: string; chain: string; label: string | null; entity_type: string | null;
  win_rate: number | null; whale_score: number | null;
  pnl_7d_usd: number | null; pnl_30d_usd: number | null;
  portfolio_value_usd: number | null; volume_7d_usd: number | null;
  trade_count_30d: number | null; avg_hold_hours: number | null;
  archetype: string | null; verified: boolean | null; last_active_at: string | null;
}

function activityAction(raw: string | null): string {
  const a = (raw ?? '').toLowerCase();
  if (a.includes('buy') || a === 'transfer_in') return 'Bought';
  if (a.includes('sell') || a === 'transfer_out') return 'Sold';
  if (a.includes('swap')) return 'Swap';
  return 'Transfer';
}

async function getWalletsFromWhales(): Promise<{ wallets: SmartWallet[]; recentMoves: SmartTrade[] }> {
  const admin = getSupabaseAdmin();
  const { data: rows, error } = await admin
    .from('whales')
    .select('address, chain, label, entity_type, win_rate, whale_score, pnl_7d_usd, pnl_30d_usd, portfolio_value_usd, volume_7d_usd, trade_count_30d, avg_hold_hours, archetype, verified, last_active_at')
    .eq('is_active', true)
    .order('whale_score', { ascending: false, nullsFirst: false })
    .limit(40);
  if (error || !rows || rows.length === 0) return { wallets: [], recentMoves: [] };

  const whales = rows as WhaleRow[];
  const addresses = whales.map((w) => w.address);

  // Independent Dune smart-money scores for these wallets (0-100), plus Dune's
  // own win-rate — used to fill our win_rate gaps and shown as a second signal.
  const duneMap = new Map<string, { score: number | null; win_rate_pct: number | null }>();
  try {
    const { data: duneRows } = await getSupabaseAdmin()
      .from('dune_smart_money_score')
      .select('wallet_address, chain, score, win_rate_pct')
      .in('wallet_address', addresses);
    for (const d of (duneRows ?? []) as Array<{ wallet_address: string; chain: string; score: number | null; win_rate_pct: number | null }>) {
      const row = { score: d.score != null ? Number(d.score) : null, win_rate_pct: d.win_rate_pct != null ? Number(d.win_rate_pct) : null };
      duneMap.set(`${d.wallet_address}:${d.chain}`, row);
      duneMap.set(`${d.wallet_address.toLowerCase()}:${d.chain}`, row); // EVM case-insensitive lookup
    }
  } catch { /* Dune surface optional — leaderboard still renders */ }

  // One query for recent activity across all listed whales; grouped per wallet.
  const { data: acts } = await admin
    .from('whale_activity')
    .select('whale_address, chain, action, token_symbol, value_usd, timestamp')
    .in('whale_address', addresses)
    .order('timestamp', { ascending: false })
    .limit(600);

  const byWallet = new Map<string, SmartTrade[]>();
  const recentMoves: SmartTrade[] = [];
  for (const a of (acts ?? []) as Array<{ whale_address: string; chain: string; action: string | null; token_symbol: string | null; value_usd: number | null; timestamp: string }>) {
    const trade: SmartTrade = {
      action: activityAction(a.action),
      token: a.token_symbol || 'TOKEN',
      amount: formatVolume(Number(a.value_usd ?? 0)),
      time: a.timestamp ? timeAgo(a.timestamp) : 'recent',
      chain: CHAIN_LABEL[a.chain] ?? a.chain?.toUpperCase().slice(0, 4) ?? 'ETH',
    };
    const list = byWallet.get(a.whale_address) ?? [];
    if (list.length < 3) { list.push(trade); byWallet.set(a.whale_address, list); }
    if (recentMoves.length < 12) recentMoves.push({ ...trade, wallet: shortenAddress(a.whale_address) });
  }

  const wallets: SmartWallet[] = whales.map((w, i) => {
    const dune = duneMap.get(`${w.address}:${w.chain}`) ?? duneMap.get(`${w.address.toLowerCase()}:${w.chain}`) ?? null;
    // Prefer our curated win_rate; fall back to Dune's when we don't have one.
    const winRateRaw = w.win_rate ?? dune?.win_rate_pct ?? null;
    const winRate = winRateRaw != null ? Math.round(Number(winRateRaw)) : null;
    const trades = w.trade_count_30d ?? 0;
    const portfolio = Number(w.portfolio_value_usd ?? 0);
    const pnl7 = Number(w.pnl_7d_usd ?? 0);
    const pnl30 = Number(w.pnl_30d_usd ?? 0);
    // PnL% = 7d realized P&L as a share of portfolio value (a real, bounded
    // number), not a fabricated price-change proxy.
    const pnlChange = portfolio > 0 ? Number(((pnl7 / portfolio) * 100).toFixed(1)) : 0;
    const totalVolume = Number(w.volume_7d_usd ?? 0) || portfolio;
    const avgHold = formatHold(w.avg_hold_hours != null ? Number(w.avg_hold_hours) : null);
    const label = w.label || `Whale ${i + 1}`;
    const chainLabel = CHAIN_LABEL[w.chain] ?? w.chain?.toUpperCase().slice(0, 4) ?? 'ETH';
    const tags: string[] = [chainLabel];
    if (w.entity_type) tags.push(w.entity_type.charAt(0).toUpperCase() + w.entity_type.slice(1));
    if (w.verified) tags.push('Verified');
    if ((w.whale_score ?? 0) >= 90) tags.push('Elite');

    return {
      id: w.address,
      address: w.address,
      shortAddress: shortenAddress(w.address),
      name: label,
      totalVolume,
      totalVolumeStr: formatVolume(totalVolume),
      recentTrades: byWallet.get(w.address) ?? [],
      chain: w.chain,
      chains: [chainLabel],
      lastActive: w.last_active_at ? timeAgo(w.last_active_at) : 'recent',
      rank: i + 1,
      tags,
      winRate,
      pnl: pnl30 !== 0 ? signedUsd(pnl30) : 'N/A',
      pnlChange,
      trades,
      avgHold,
      bestTrade: pnl30 > 0 ? formatVolume(pnl30) : 'N/A',
      archetype: normalizeArchetype(w.archetype, winRate ?? 0, trades, pnlChange, avgHold),
      weeklyPnlChange: pnlChange,
      isRiser: i < 3 && pnl7 > 0,
      duneScore: dune?.score ?? null,
    };
  });

  return { wallets, recentMoves };
}

// Real convergence straight from the curated smart_money_convergence table —
// the same signal the Convergence Radar uses. Replaces the old naive grouping
// that counted shared token SYMBOLS across derived recentTrades (which was
// empty for the transfer-only Alchemy wallets).
async function getConvergenceFromTable(): Promise<ConvergenceSignal[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin
      .from('smart_money_convergence')
      .select('token_symbol, token_address, chain, wallet_count, total_value_usd')
      .eq('is_active', true)
      .gte('wallet_count', 2)
      .order('wallet_count', { ascending: false })
      .limit(5);
    return (data ?? []).map((c: { token_symbol: string | null; token_address: string; chain: string; wallet_count: number | null; total_value_usd: number | null }) => ({
      token: c.token_address,
      symbol: c.token_symbol || `${c.token_address.slice(0, 6)}…`,
      walletCount: c.wallet_count ?? 0,
      totalVolume: formatVolume(Number(c.total_value_usd ?? 0)),
      timeWindow: '24h',
    }));
  } catch { return []; }
}

export async function GET() {
  try {
    // Primary: curated whales dataset (real win rate / P&L / archetype).
    const [{ wallets: whaleWallets, recentMoves: whaleMoves }, convergence] = await Promise.all([
      getWalletsFromWhales(),
      getConvergenceFromTable(),
    ]);

    let wallets = whaleWallets;
    let recentMoves = whaleMoves;
    let source = 'whales';

    // Fallback: only if the curated table is empty, derive from raw
    // Alchemy/DexScreener data (win rate unknown → null, shown as "—").
    if (wallets.length === 0) {
      const [alchemyWallets, dexWallets, dexMoves] = await Promise.all([
        getWalletsFromAlchemy(),
        getWalletsFromDexScreener(),
        getRecentMovesFromDexScreener(),
      ]);
      wallets = alchemyWallets.length > 0 ? [...alchemyWallets, ...dexWallets.slice(0, 5)] : dexWallets;
      wallets.forEach((w, i) => { w.rank = i + 1; });
      recentMoves = dexMoves;
      source = alchemyWallets.length > 0 ? 'alchemy+dex' : 'dexscreener';
    }

    // Weekly risers — top positive movers.
    const weeklyRisers = [...wallets]
      .filter((w) => w.isRiser)
      .sort((a, b) => (b.weeklyPnlChange ?? 0) - (a.weeklyPnlChange ?? 0))
      .slice(0, 3);

    return NextResponse.json(
      { wallets, recentMoves, convergence, weeklyRisers, timestamp: Date.now(), source },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' } }
    );
  } catch {
    return NextResponse.json({ wallets: [], recentMoves: [], timestamp: Date.now(), error: 'Failed to fetch smart money data' }, { status: 500 });
  }
}
