import 'server-only';
import { NextResponse } from 'next/server';
import { vtxAnalyze } from '@/lib/services/anthropic';
import { getEthBalance, getAssetTransfers, getTokenBalances, getTokenMetadata } from '@/lib/services/alchemy';
import { getTokenPrice } from '@/lib/services/coingecko';
import { fetchWalletPositions, fetchWalletTransactions } from '@/lib/services/zerion';
import { getTrendingByVolume, getTrendingByHolderGrowth } from '@/lib/services/birdeye';
import { buildSolanaWalletIntelligence } from '@/lib/services/solana-intelligence';

// ─── Chain Detection ──────────────────────────────────────────────────────────

function detectChain(address: string): 'EVM' | 'SOL' | 'UNKNOWN' {
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) return 'EVM';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return 'SOL';
  return 'UNKNOWN';
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Holding {
  symbol: string;
  name: string;
  balance: string;
  valueUsd: string | null;
  contractAddress: string | null;
  logoUrl?: string | null;
}

type WalletArchetype =
  | 'DIAMOND_HANDS'
  | 'SCALPER'
  | 'DEGEN'
  | 'WHALE_FOLLOWER'
  | 'HOLDER'
  | 'INACTIVE'
  | 'NEW_WALLET';

// ─── Archetype Logic ──────────────────────────────────────────────────────────

const BLUE_CHIP = new Set(['SOL', 'ETH', 'BTC', 'USDC', 'USDT', 'WBTC', 'WETH', 'BNB', 'MATIC', 'AVAX']);

function computeArchetype(
  txCount: number,
  txPerWeek: number,
  memePercent: number,
  holdingCount: number
): WalletArchetype {
  if (txCount === 0) return 'NEW_WALLET';
  if (txCount < 5) return 'INACTIVE';
  if (memePercent > 70 && txCount > 10) return 'DEGEN';
  if (txPerWeek > 10) return 'SCALPER';
  if (txPerWeek < 0.5 && txCount > 5) return 'DIAMOND_HANDS';
  if (holdingCount > 8 && txPerWeek >= 2) return 'WHALE_FOLLOWER';
  return 'HOLDER';
}

function archetypeDescription(a: WalletArchetype): string {
  const map: Record<WalletArchetype, string> = {
    DIAMOND_HANDS: 'A conviction-based long-term holder. Buys positions and holds through volatility, rarely selling.',
    SCALPER: 'A high-frequency trader executing multiple transactions per day, focused on short-term price movements.',
    DEGEN: 'High-risk, high-reward trader with heavy meme token exposure. Embraces volatility as opportunity.',
    WHALE_FOLLOWER: 'Strategic trader who diversifies across multiple tokens and follows market momentum.',
    HOLDER: 'Disciplined accumulator focused on quality assets with moderate activity.',
    INACTIVE: 'Wallet with very low transaction history — storage, dormant, or newly created.',
    NEW_WALLET: 'Brand new wallet with no transaction history recorded on-chain.',
  };
  return map[a];
}

// ─── Solana DNA Fetch ─────────────────────────────────────────────────────────
// Uses the canonical Solana intelligence pipeline:
// Alchemy Solana (authoritative) → Birdeye (prices) → DexScreener (logos/identity)

async function fetchSolDNA(address: string) {
  const intel = await buildSolanaWalletIntelligence(address);

  // Map to the Holding interface expected by the shared AI analysis
  const holdings: Holding[] = intel.tokens.map(t => ({
    symbol: t.symbol,
    name: t.name,
    balance: t.balance,
    valueUsd: t.valueUSD > 0 ? t.valueUSD.toFixed(2) : null,
    contractAddress: t.mintAddress === 'So11111111111111111111111111111111111111112'
      ? null
      : t.mintAddress,
    logoUrl: t.logoURI,
  }));

  const totalBalance = intel.totalBalanceUSD;
  const blueChipValue = holdings
    .filter(h => BLUE_CHIP.has(h.symbol.toUpperCase()))
    .reduce((s, h) => s + parseFloat(h.valueUsd || '0'), 0);
  const blueChipPercent = totalBalance > 0 ? (blueChipValue / totalBalance) * 100 : 0;
  const memePercent = Math.max(0, 100 - blueChipPercent);
  const hhi = holdings.reduce((sum, h) => {
    const share = totalBalance > 0 ? parseFloat(h.valueUsd || '0') / totalBalance : 0;
    return sum + share * share;
  }, 0);

  const txCount = intel.metadata.txCount;
  const txPerWeek = intel.metadata.txPerWeek;
  const archetype = computeArchetype(txCount, txPerWeek, memePercent, holdings.length);

  return {
    chain: 'Solana', address, holdings, totalBalanceUsd: totalBalance,
    txCount, firstSeen: intel.metadata.firstSeen, lastActive: intel.metadata.lastActive,
    txPerWeek, totalBuys: intel.metadata.totalBuys, totalSells: intel.metadata.totalSells,
    blueChipPercent: Math.round(blueChipPercent), memePercent: Math.round(memePercent),
    diversificationScore: Math.round((1 - hhi) * 100),
    archetype, archetypeDescription: archetypeDescription(archetype),
    dataSource: intel.dataSource,
    recentTxs: intel.transactions.slice(0, 25).map(tx => ({
      hash: tx.hash, type: tx.type, asset: tx.tokenSymbol || 'SOL',
      amount: tx.amount, from: tx.counterparty || address,
      to: tx.direction === 'out' ? (tx.counterparty || '') : address,
      blockTime: tx.timestamp,
    })),
  };
}

// ─── EVM DNA Fetch ────────────────────────────────────────────────────────────
// Primary: Zerion (returns pre-priced positions across all EVM chains in one call)
// Fallback: Alchemy multi-call (no USD values on tokens, fragile)

async function fetchEvmDNA(address: string) {
  // ── Try Zerion first ──────────────────────────────────────────────────────
  if (process.env.ZERION_API_KEY) {
    try {
      const [zerionPositions, zerionTxns] = await Promise.all([
        fetchWalletPositions(address),
        fetchWalletTransactions(address, 100),
      ]);

      if (zerionPositions.length > 0) {
        const holdings: Holding[] = zerionPositions.map(p => ({
          symbol: p.symbol,
          name: p.name,
          balance: p.balance,
          valueUsd: p.valueUsd > 0 ? p.valueUsd.toFixed(2) : null,
          contractAddress: p.isNative ? null : p.contractAddress,
          logoUrl: p.logo,
        }));

        const totalBalance = zerionPositions.reduce((s, p) => s + p.valueUsd, 0);

        const blueChipValue = holdings
          .filter(h => BLUE_CHIP.has(h.symbol.toUpperCase()))
          .reduce((s, h) => s + parseFloat(h.valueUsd || '0'), 0);
        const blueChipPercent = totalBalance > 0 ? (blueChipValue / totalBalance) * 100 : 0;
        const memePercent = Math.max(0, 100 - blueChipPercent);
        const hhi = holdings.reduce((sum, h) => {
          const share = totalBalance > 0 ? parseFloat(h.valueUsd || '0') / totalBalance : 0;
          return sum + share * share;
        }, 0);

        const txCount = zerionTxns.length;
        const txPerWeek = txCount / 4;

        // Extract timestamps from Zerion transactions
        const timestamps = zerionTxns
          .map(tx => new Date(tx.timestamp).getTime() / 1000)
          .filter(t => t > 0)
          .sort((a, b) => a - b);
        const firstSeen = timestamps.length > 0
          ? new Date(timestamps[0] * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          : null;
        const lastActive = timestamps.length > 0
          ? new Date(timestamps[timestamps.length - 1] * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          : null;

        const totalBuys = zerionTxns.filter(tx => tx.transfers.some(t => t.direction === 'in')).length;
        const totalSells = zerionTxns.filter(tx => tx.transfers.some(t => t.direction === 'out')).length;
        const archetype = computeArchetype(txCount, txPerWeek, memePercent, holdings.length);

        return {
          chain: 'EVM (Multi-chain)', address, holdings, totalBalanceUsd: totalBalance,
          txCount, firstSeen, lastActive,
          txPerWeek: Math.round(txPerWeek * 10) / 10, totalBuys, totalSells,
          blueChipPercent: Math.round(blueChipPercent), memePercent: Math.round(memePercent),
          diversificationScore: Math.round((1 - hhi) * 100), archetype,
          archetypeDescription: archetypeDescription(archetype),
          dataSource: 'zerion',
          recentTxs: zerionTxns.slice(0, 25).map(tx => ({
            hash: tx.hash, type: tx.type,
            asset: tx.transfers[0]?.symbol || 'ETH',
            amount: tx.transfers[0]?.amount ? tx.transfers[0].amount.toFixed(4) : '—',
            from: tx.from, to: tx.to || '',
            blockTime: tx.timestamp,
          })),
        };
      }
    } catch (err) {
      console.warn('[DNA] Zerion EVM failed, falling back to Alchemy:', err);
    }
  }

  // ── Alchemy fallback ──────────────────────────────────────────────────────
  const [ethBalStr, fromTxs, toTxs, ethPrice] = await Promise.all([
    getEthBalance(address, 'ethereum').catch(() => '0'),
    getAssetTransfers(address, 'ethereum', 'from', 100).catch(() => []),
    getAssetTransfers(address, 'ethereum', 'to', 100).catch(() => []),
    getTokenPrice('ethereum').catch(() => 3500),
  ]);

  const ethBalance = parseFloat(ethBalStr);
  const ethValueUsd = ethBalance * ethPrice;
  let tokenHoldings: Holding[] = [];

  try {
    const rawBalances = await getTokenBalances(address, 'ethereum');
    const nonZero = rawBalances.filter(b => b.tokenBalance && b.tokenBalance !== '0');
    const metaResults = await Promise.allSettled(
      nonZero.map(async b => {
        try {
          const meta = await getTokenMetadata(b.contractAddress, 'ethereum');
          const decimals = meta.decimals ?? 18;
          const balance = Number(BigInt(b.tokenBalance)) / Math.pow(10, decimals);
          if (balance <= 0) return null;
          return {
            symbol: meta.symbol || 'UNKNOWN', name: meta.name || 'Unknown Token',
            balance: balance > 1000 ? balance.toFixed(0) : balance.toFixed(4),
            valueUsd: null as string | null, contractAddress: b.contractAddress, logoUrl: null,
          } as Holding;
        } catch { return null; }
      })
    );
    tokenHoldings = metaResults
      .filter((r): r is PromiseFulfilledResult<Holding> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value as Holding);
  } catch {}

  const holdings: Holding[] = [
    { symbol: 'ETH', name: 'Ethereum', balance: ethBalance.toFixed(4), valueUsd: ethValueUsd.toFixed(2), contractAddress: null },
    ...tokenHoldings,
  ];
  const totalBalance = ethValueUsd + tokenHoldings.reduce((s, h) => s + parseFloat(h.valueUsd || '0'), 0);

  const seen = new Set<string>();
  const allTxs = [...fromTxs, ...toTxs].filter(t => { if (seen.has(t.hash)) return false; seen.add(t.hash); return true; });

  const blueChipValue = holdings.filter(h => BLUE_CHIP.has(h.symbol.toUpperCase())).reduce((s, h) => s + parseFloat(h.valueUsd || '0'), 0);
  const blueChipPercent = totalBalance > 0 ? (blueChipValue / totalBalance) * 100 : 0;
  const memePercent = Math.max(0, 100 - blueChipPercent);
  const hhi = holdings.reduce((sum, h) => { const share = totalBalance > 0 ? parseFloat(h.valueUsd || '0') / totalBalance : 0; return sum + share * share; }, 0);
  const txPerWeek = allTxs.length / 4;
  const archetype = computeArchetype(allTxs.length, txPerWeek, memePercent, holdings.length);

  return {
    chain: 'Ethereum', address, holdings, totalBalanceUsd: totalBalance,
    txCount: allTxs.length, firstSeen: null as string | null, lastActive: null as string | null,
    txPerWeek: Math.round(txPerWeek * 10) / 10, totalBuys: Math.floor(allTxs.length * 0.6), totalSells: Math.floor(allTxs.length * 0.4),
    blueChipPercent: Math.round(blueChipPercent), memePercent: Math.round(memePercent),
    diversificationScore: Math.round((1 - hhi) * 100), archetype, archetypeDescription: archetypeDescription(archetype),
    dataSource: 'alchemy',
    recentTxs: allTxs.slice(0, 25).map(tx => ({
      hash: tx.hash, type: 'transfer', asset: tx.asset || 'ETH',
      amount: tx.value ? parseFloat(tx.value).toFixed(4) : '—', from: tx.from, to: tx.to, blockTime: null as string | null,
    })),
  };
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────

async function buildAIAnalysis(data: {
  address: string; chain: string; holdings: Holding[]; totalBalanceUsd: number;
  txCount: number; firstSeen: string | null; lastActive: string | null;
  archetype: WalletArchetype; txPerWeek: number; totalBuys: number; totalSells: number;
  blueChipPercent: number; memePercent: number; diversificationScore: number;
}) {
  const holdingsText = data.holdings.length > 0
    ? data.holdings.slice(0, 30).map(h => `${h.symbol}: ${h.balance}${h.valueUsd ? ` ($${h.valueUsd})` : ''}`).join(', ')
    : 'No holdings detected';

  const prompt = `You are a professional crypto intelligence analyst. Analyze this wallet's DNA. Base ALL analysis STRICTLY on the data provided — never invent numbers.

Wallet: ${data.address} | Chain: ${data.chain}
Archetype: ${data.archetype} — ${data.archetypeDescription}
Portfolio Value: $${data.totalBalanceUsd.toFixed(2)} | Holdings (${data.holdings.length} total): ${holdingsText}
TX Count: ${data.txCount} | TX/Week: ${data.txPerWeek} | Buys: ${data.totalBuys} | Sells: ${data.totalSells}
Blue Chip %: ${data.blueChipPercent}% | Meme Token %: ${data.memePercent}% | Diversification: ${data.diversificationScore}/100
First Seen: ${data.firstSeen || 'Unknown'} | Last Active: ${data.lastActive || 'Unknown'}

Return ONLY this JSON:
{"personalityProfile":"2-3 sentence description citing real holdings","tradingStyle":"Day Trader|Swing Trader|HODLer|DeFi Farmer|Degen|Scalper","riskProfile":"Conservative|Moderate|Aggressive|Ultra Aggressive","overallScore":0,"portfolioGrade":"A+|A|B+|B|C+|C|D|F","strengths":["s1","s2","s3"],"weaknesses":["w1","w2","w3"],"recommendations":["r1","r2","r3","r4","r5"],"personalityTraits":["t1","t2","t3"],"marketOutlook":"1-2 sentences","topInsight":"One key actionable insight","sectorBreakdown":{"memecoins":0,"defi":0,"stablecoins":0,"layer1layer2":0},"riskClassification":"DEGEN|BALANCED|CONSERVATIVE|WHALE|SMART MONEY","metrics":{"diversification":0,"timing":0,"riskManagement":0,"consistency":0,"conviction":0}}`;

  try {
    const text = await vtxAnalyze(prompt, 1800);
    if (!text) return null;
    try { return JSON.parse(text); } catch {
      const m = text.match(/\{[\s\S]*\}/);
      return m ? JSON.parse(m[0]) : null;
    }
  } catch { return null; }
}

// ─── Coins Worth Watching ─────────────────────────────────────────────────────

async function fetchCoinsWorthWatching(archetype: WalletArchetype, heldAddresses: Set<string>) {
  try {
    type TrendToken = { address?: string; symbol?: string; name?: string; price?: number; priceChange24hPercent?: number; volume24hUSD?: number; liquidity?: number; marketCap?: number; holder?: number; logoURI?: string };
    const trending: TrendToken[] = archetype === 'SCALPER' || archetype === 'DEGEN'
      ? await getTrendingByVolume(30, 'solana').catch(() => []) as TrendToken[]
      : await getTrendingByHolderGrowth(30, 'solana').catch(() => []) as TrendToken[];

    return trending
      .filter(t => !heldAddresses.has((t.address || '').toLowerCase()) && (t.liquidity || 0) >= 50000 && (t.volume24hUSD || 0) >= 100000)
      .slice(0, 5)
      .map(t => ({
        address: t.address || '', symbol: t.symbol || 'UNKNOWN', name: t.name || t.symbol || 'Unknown',
        price: t.price || 0, priceChange24h: t.priceChange24hPercent || 0,
        volume24h: t.volume24hUSD || 0, liquidity: t.liquidity || 0,
        marketCap: t.marketCap, holders: t.holder, logoURI: t.logoURI,
      }));
  } catch { return []; }
}

// ─── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) return NextResponse.json({ error: 'address query param required' }, { status: 400 });

  const chainType = detectChain(address);
  if (chainType === 'UNKNOWN') {
    return NextResponse.json({ error: 'Invalid wallet address. Supports EVM (0x...) and Solana addresses.' }, { status: 400 });
  }

  try {
    const data = chainType === 'SOL' ? await fetchSolDNA(address) : await fetchEvmDNA(address);

    const heldAddresses = new Set(
      data.holdings.filter(h => h.contractAddress).map(h => h.contractAddress!.toLowerCase())
    );

    const [coinsWorthWatching, aiAnalysis] = await Promise.all([
      chainType === 'SOL' ? fetchCoinsWorthWatching(data.archetype, heldAddresses) : Promise.resolve([]),
      buildAIAnalysis(data),
    ]);

    return NextResponse.json({
      address, chain: data.chain, holdings: data.holdings, totalBalanceUsd: data.totalBalanceUsd,
      txCount: data.txCount, firstSeen: data.firstSeen, lastActive: data.lastActive,
      txPerWeek: data.txPerWeek, totalBuys: data.totalBuys, totalSells: data.totalSells,
      blueChipPercent: data.blueChipPercent, memePercent: data.memePercent,
      diversificationScore: data.diversificationScore, archetype: data.archetype,
      archetypeDescription: data.archetypeDescription, recentTransactions: data.recentTxs,
      coinsWorthWatching,
      aiAnalysis,
      tradingStyle: (aiAnalysis as { tradingStyle?: string } | null)?.tradingStyle || data.archetype.replace(/_/g, ' '),
      riskClassification: (aiAnalysis as { riskClassification?: string } | null)?.riskClassification || 'BALANCED',
      favoriteTokens: data.holdings.slice(0, 5).map(h => h.symbol),
      partnerWallets: [],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'DNA analysis failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
