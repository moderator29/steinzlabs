import 'server-only';
import { NextResponse } from 'next/server';
import { vtxAnalyze } from '@/lib/services/anthropic';
import { getEthBalance, getAssetTransfers, getTokenBalances, getTokenMetadata } from '@/lib/services/alchemy';
import { getTokenPrice } from '@/lib/services/coingecko';
import { getTokenPairs } from '@/lib/services/dexscreener';
import { getBirdeyeTokenOverview } from '@/lib/services/birdeye';
import { getSolanaSOLBalance, getSolanaWalletTokens, getSolanaTransactions } from '@/lib/services/helius';
import type { TokenTransfer } from '@/lib/services/alchemy';
import type { HeliusTransaction } from '@/lib/services/helius';

// ─── Chain Detection ──────────────────────────────────────────────────────────

function detectChain(address: string): 'EVM' | 'SOL' | 'UNKNOWN' {
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) return 'EVM';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return 'SOL';
  return 'UNKNOWN';
}

// ─── Trading Stats ────────────────────────────────────────────────────────────

interface TradingStats {
  txCount: number;
  firstSeen: string | null;
  lastActive: string | null;
  totalVolume: number;
  tradingStyle: string;
  favoriteTokens: string[];
  partnerWallets: Array<{ address: string; txCount: number; volume: string; label: string }>;
}

function calcEvmTradingStats(txs: TokenTransfer[]): TradingStats {
  if (!txs.length) {
    return { txCount: 0, firstSeen: null, lastActive: null, totalVolume: 0, tradingStyle: 'Unknown', favoriteTokens: [], partnerWallets: [] };
  }

  const tokenFreq: Record<string, number> = {};
  const counterpartyCnt: Record<string, number> = {};
  const counterpartyVol: Record<string, number> = {};
  let totalVolume = 0;

  for (const tx of txs) {
    totalVolume += parseFloat(tx.value || '0');
    const asset = tx.asset || 'ETH';
    tokenFreq[asset] = (tokenFreq[asset] || 0) + 1;
    const to = tx.to?.toLowerCase();
    if (to) {
      counterpartyCnt[to] = (counterpartyCnt[to] || 0) + 1;
      counterpartyVol[to] = (counterpartyVol[to] || 0) + parseFloat(tx.value || '0');
    }
  }

  const favoriteTokens = Object.entries(tokenFreq).sort(([, a], [, b]) => b - a).slice(0, 3).map(([t]) => t);
  const partnerWallets = Object.entries(counterpartyCnt)
    .sort(([, a], [, b]) => b - a).slice(0, 5)
    .map(([addr, count]) => ({ address: addr, txCount: count, volume: (counterpartyVol[addr] || 0).toFixed(4), label: 'Unknown' }));

  const tradingStyle = txs.length > 200 ? 'Day Trader' : txs.length > 50 ? 'Swing Trader' : 'HODLer';

  return { txCount: txs.length, firstSeen: null, lastActive: null, totalVolume, tradingStyle, favoriteTokens, partnerWallets };
}

function calcSolTradingStats(txs: HeliusTransaction[]): TradingStats {
  if (!txs.length) {
    return { txCount: 0, firstSeen: null, lastActive: null, totalVolume: 0, tradingStyle: 'Unknown', favoriteTokens: [], partnerWallets: [] };
  }

  const timestamps = txs.filter(t => t.timestamp).map(t => t.timestamp * 1000);
  const firstSeen = timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null;
  const lastActive = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;

  const spanDays = timestamps.length >= 2
    ? (Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60 * 24)
    : 1;
  const txPerDay = txs.length / Math.max(spanDays, 1);
  const tradingStyle = txPerDay > 3 ? 'Day Trader' : txPerDay > 0.5 ? 'Swing Trader' : 'HODLer';

  return { txCount: txs.length, firstSeen, lastActive, totalVolume: 0, tradingStyle, favoriteTokens: [], partnerWallets: [] };
}

function classifyWallet(holdings: unknown[], totalBalance: number, txCount: number): string {
  if (totalBalance >= 1_000_000) return 'WHALE';
  if (totalBalance >= 100_000) return 'SMART MONEY';
  if (txCount > 500) return 'DEGEN';
  if ((holdings as Array<unknown>).length >= 5 && totalBalance >= 10_000) return 'BALANCED';
  return 'CONSERVATIVE';
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────

async function callAIForAnalysis(
  walletAddress: string,
  chain: string,
  holdings: Array<{ symbol: string; balance: string; valueUsd?: string | null }>,
  stats: TradingStats,
  totalBalance: number
): Promise<unknown> {
  const holdingsText = holdings.length > 0
    ? holdings.slice(0, 30).map(h => `${h.symbol}: ${h.balance} ($${h.valueUsd || '?'})`).join(', ')
    : 'No holdings detected';

  const prompt = `You are a professional crypto intelligence analyst. Analyze this wallet's complete DNA and provide deep intelligence.

Wallet: ${walletAddress}
Chain: ${chain}
Total Portfolio Value: $${totalBalance}
Holdings: ${holdingsText}
Transaction Count: ${stats.txCount}
Trading Style Detected: ${stats.tradingStyle}
First Seen: ${stats.firstSeen || 'Unknown'}
Last Active: ${stats.lastActive || 'Unknown'}
Top Trading Partners: ${stats.partnerWallets.slice(0, 3).map(p => p.address).join(', ') || 'None detected'}

Return ONLY this JSON structure:
{
  "personalityProfile": "2-3 sentence description of this trader",
  "tradingStyle": "Day Trader" | "Swing Trader" | "HODLer" | "DeFi Farmer" | "Degen" | "Scalper",
  "riskProfile": "Conservative" | "Moderate" | "Aggressive" | "Ultra Aggressive",
  "overallScore": 0-100,
  "portfolioGrade": "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F",
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2", "weakness3"],
  "recommendations": ["rec1", "rec2", "rec3", "rec4", "rec5"],
  "personalityTraits": ["trait1", "trait2", "trait3"],
  "marketOutlook": "1-2 sentence outlook",
  "topInsight": "One key actionable insight",
  "sectorBreakdown": { "memecoins": 0, "defi": 0, "stablecoins": 0, "layer1layer2": 0 },
  "riskClassification": "DEGEN" | "BALANCED" | "CONSERVATIVE" | "WHALE" | "SMART MONEY",
  "metrics": { "diversification": 0-100, "timing": 0-100, "riskManagement": 0-100, "consistency": 0-100, "conviction": 0-100 }
}`;

  try {
    const responseText = await vtxAnalyze(prompt, 1500);
    if (!responseText) return null;
    try {
      return JSON.parse(responseText);
    } catch {
      const match = responseText.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : null;
    }
  } catch {
    return null;
  }
}

// ─── Solana Wallet Data ───────────────────────────────────────────────────────

async function fetchSolWalletData(address: string): Promise<{
  holdings: Array<{ symbol: string; name: string; balance: string; valueUsd: string | null; contractAddress: string | null }>;
  totalBalanceUsd: string;
  txCount: number;
  transactions: HeliusTransaction[];
}> {
  try {
    const [solBalance, splTokens, txs, solPrice] = await Promise.all([
      getSolanaSOLBalance(address).catch(() => 0),
      getSolanaWalletTokens(address).catch(() => []),
      getSolanaTransactions(address, 50).catch(() => []),
      getTokenPrice('solana').catch(() => 170),
    ]);

    const solValueUsd = solBalance * solPrice;

    // Get price+metadata for SPL tokens — Birdeye primary, DexScreener fallback
    const tokenResults = await Promise.allSettled(
      splTokens.slice(0, 50).map(async t => {
        try {
          // Try Birdeye first (more accurate for Solana)
          const overview = await getBirdeyeTokenOverview(t.mint, 'solana').catch(() => null);
          if (overview && overview.price > 0) {
            const valueUsd = t.uiAmount * overview.price;
            return {
              symbol: overview.symbol || t.mint.slice(0, 6),
              name: overview.name || 'SPL Token',
              balance: t.uiAmount > 1000 ? t.uiAmount.toFixed(0) : t.uiAmount.toFixed(4),
              valueUsd: valueUsd > 0 ? valueUsd.toFixed(2) : null,
              contractAddress: t.mint,
            };
          }
          // Fallback to DexScreener
          const pairs = await getTokenPairs(t.mint);
          const top = pairs[0];
          const priceUsd = top?.priceUsd ? parseFloat(String(top.priceUsd)) : 0;
          const valueUsd = t.uiAmount * priceUsd;
          return {
            symbol: top?.baseToken.symbol || t.mint.slice(0, 6),
            name: top?.baseToken.name || 'SPL Token',
            balance: t.uiAmount > 1000 ? t.uiAmount.toFixed(0) : t.uiAmount.toFixed(4),
            valueUsd: valueUsd > 0 ? valueUsd.toFixed(2) : null,
            contractAddress: t.mint,
          };
        } catch {
          return { symbol: t.mint.slice(0, 6), name: 'SPL Token', balance: t.uiAmount.toFixed(4), valueUsd: null, contractAddress: t.mint };
        }
      })
    );

    let totalTokenValue = 0;
    const tokenHoldings = tokenResults
      .filter((r): r is PromiseFulfilledResult<{ symbol: string; name: string; balance: string; valueUsd: string | null; contractAddress: string }> =>
        r.status === 'fulfilled')
      .map(r => { if (r.value.valueUsd) totalTokenValue += parseFloat(r.value.valueUsd); return r.value; })
      .sort((a, b) => parseFloat(b.valueUsd || '0') - parseFloat(a.valueUsd || '0'));

    return {
      holdings: [
        { symbol: 'SOL', name: 'Solana', balance: solBalance.toFixed(4), valueUsd: solValueUsd.toFixed(2), contractAddress: null },
        ...tokenHoldings,
      ],
      totalBalanceUsd: (solValueUsd + totalTokenValue).toFixed(2),
      txCount: txs.length,
      transactions: txs,
    };
  } catch {
    return { holdings: [], totalBalanceUsd: '0', txCount: 0, transactions: [] };
  }
}

// ─── EVM Wallet Data ──────────────────────────────────────────────────────────

async function fetchEvmWalletData(address: string): Promise<{
  holdings: Array<{ symbol: string; name: string; balance: string; valueUsd: string | null; contractAddress: string | null }>;
  totalBalanceUsd: string;
  txCount: number;
  transactions: TokenTransfer[];
}> {
  try {
    const [ethBalStr, fromTxs, toTxs, ethPrice] = await Promise.all([
      getEthBalance(address, 'ethereum').catch(() => '0'),
      getAssetTransfers(address, 'ethereum', 'from', 50).catch(() => []),
      getAssetTransfers(address, 'ethereum', 'to', 50).catch(() => []),
      getTokenPrice('ethereum').catch(() => 3500),
    ]);

    const ethBalance = parseFloat(ethBalStr);
    const ethValueUsd = ethBalance * ethPrice;

    let tokenHoldings: Array<{ symbol: string; name: string; balance: string; valueUsd: string | null; contractAddress: string }> = [];
    try {
      const rawBalances = await getTokenBalances(address, 'ethereum');
      const nonZero = rawBalances.filter(b => b.tokenBalance && b.tokenBalance !== '0').slice(0, 50);

      const metaResults = await Promise.allSettled(
        nonZero.map(async b => {
          try {
            const meta = await getTokenMetadata(b.contractAddress, 'ethereum');
            const decimals = meta.decimals ?? 18;
            const balance = Number(BigInt(b.tokenBalance)) / Math.pow(10, decimals);
            if (balance <= 0) return null;
            return {
              symbol: meta.symbol || 'UNKNOWN',
              name: meta.name || 'Unknown Token',
              balance: balance > 1000 ? balance.toFixed(0) : balance.toFixed(4),
              valueUsd: null as string | null,
              contractAddress: b.contractAddress,
            };
          } catch { return null; }
        })
      );
      tokenHoldings = metaResults
        .filter((r): r is PromiseFulfilledResult<NonNullable<{ symbol: string; name: string; balance: string; valueUsd: string | null; contractAddress: string }>> =>
          r.status === 'fulfilled' && r.value !== null)
        .map(r => r.value as { symbol: string; name: string; balance: string; valueUsd: string | null; contractAddress: string });
    } catch {}

    // Dedupe transactions
    const seen = new Set<string>();
    const allTxs = [...fromTxs, ...toTxs].filter(t => { if (seen.has(t.hash)) return false; seen.add(t.hash); return true; });

    return {
      holdings: [
        { symbol: 'ETH', name: 'Ethereum', balance: ethBalance.toFixed(4), valueUsd: ethValueUsd.toFixed(2), contractAddress: null },
        ...tokenHoldings,
      ],
      totalBalanceUsd: ethValueUsd.toFixed(2),
      txCount: allTxs.length,
      transactions: allTxs,
    };
  } catch {
    return { holdings: [], totalBalanceUsd: '0', txCount: 0, transactions: [] };
  }
}

// ─── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'address query param required' }, { status: 400 });
  }

  const chain = detectChain(address);
  if (chain === 'UNKNOWN') {
    return NextResponse.json({ error: 'Invalid wallet address. Supports EVM (0x...) and Solana addresses.' }, { status: 400 });
  }

  try {
    let holdings: Array<{ symbol: string; name: string; balance: string; valueUsd: string | null; contractAddress: string | null }> = [];
    let totalBalance = 0;
    let stats: TradingStats;
    let recentTxsForOutput: Array<{ hash: string; type: string; asset: string; amount: string; from: string; to: string; blockTime: string | null }> = [];

    if (chain === 'SOL') {
      const data = await fetchSolWalletData(address);
      holdings = data.holdings;
      totalBalance = parseFloat(data.totalBalanceUsd);
      stats = calcSolTradingStats(data.transactions);
      recentTxsForOutput = data.transactions.slice(0, 25).map(tx => ({
        hash: tx.signature,
        type: tx.type || 'transaction',
        asset: 'SOL',
        amount: '—',
        from: tx.feePayer,
        to: '',
        blockTime: tx.timestamp ? new Date(tx.timestamp * 1000).toISOString() : null,
      }));
    } else {
      const data = await fetchEvmWalletData(address);
      holdings = data.holdings;
      totalBalance = parseFloat(data.totalBalanceUsd);
      stats = calcEvmTradingStats(data.transactions);
      recentTxsForOutput = data.transactions.slice(0, 25).map(tx => ({
        hash: tx.hash,
        type: 'transfer',
        asset: tx.asset || 'ETH',
        amount: tx.value ? parseFloat(tx.value).toFixed(4) : '—',
        from: tx.from,
        to: tx.to,
        blockTime: null,
      }));
    }

    const riskClass = classifyWallet(holdings, totalBalance, stats.txCount);
    const aiAnalysis = await callAIForAnalysis(
      address,
      chain === 'EVM' ? 'Ethereum' : 'Solana',
      holdings,
      stats,
      totalBalance
    );

    return NextResponse.json({
      address,
      chain: chain === 'EVM' ? 'Ethereum' : 'Solana',
      holdings,
      totalBalanceUsd: totalBalance,
      txCount: stats.txCount,
      firstSeen: stats.firstSeen,
      lastActive: stats.lastActive,
      totalVolume: stats.totalVolume,
      tradingStyle: stats.tradingStyle,
      favoriteTokens: stats.favoriteTokens,
      partnerWallets: stats.partnerWallets,
      riskClassification: (aiAnalysis as { riskClassification?: string } | null)?.riskClassification || riskClass,
      aiAnalysis,
      recentTransactions: recentTxsForOutput,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Analysis failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
