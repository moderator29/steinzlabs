import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { withTierGate } from '@/lib/subscriptions/apiTierGate';
import { vtxAnalyze } from '@/lib/services/anthropic';
import { getTrendingByVolume, getTrendingByHolderGrowth } from '@/lib/services/birdeye';
import { buildSolanaWalletIntelligence } from '@/lib/services/solana-intelligence';
import { buildEvmWalletIntelligence } from '@/lib/services/evm-intelligence';
import { lookupEntity } from '@/lib/clusters/entityRegistry';
import { getEntityByAddress } from '@/lib/services/arkham';
import { normalizeAddress, isEvmAddress } from '@/lib/utils/addressNormalize';

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

// Partner wallets = the counterparties this wallet interacts with most, derived
// purely from its real recent transactions (the non-self side of each transfer).
// Known EVM entities (CEX / DEX / bridge / mixer) are tagged from the on-chain
// registry; volume is summed from the trade-time USD values the intel pipeline
// already priced, so nothing here is invented.
export interface PartnerWallet {
  address: string;
  txCount: number;
  inbound: number;
  outbound: number;
  volumeUsd: number;
  label: string | null;
  category: string | null;
  parent: string | null;
}

interface PartnerInteraction { counterparty: string; inbound: boolean; valueUsd: number }

function aggregatePartners(interactions: PartnerInteraction[], evm: boolean): PartnerWallet[] {
  const map = new Map<string, { count: number; inbound: number; outbound: number; volumeUsd: number }>();
  for (const it of interactions) {
    if (!it.counterparty) continue;
    const e = map.get(it.counterparty) ?? { count: 0, inbound: 0, outbound: 0, volumeUsd: 0 };
    e.count++;
    if (it.inbound) e.inbound++; else e.outbound++;
    if (Number.isFinite(it.valueUsd) && it.valueUsd > 0) e.volumeUsd += it.valueUsd;
    map.set(it.counterparty, e);
  }
  return Array.from(map.entries())
    .map(([address, c]) => {
      const ent = evm && isEvmAddress(address) ? lookupEntity(address) : null;
      return {
        address,
        txCount: c.count,
        inbound: c.inbound,
        outbound: c.outbound,
        volumeUsd: Math.round(c.volumeUsd * 100) / 100,
        label: ent?.name ?? null,
        category: ent?.category ?? null,
        parent: ent?.parent ?? null,
      };
    })
    .sort((a, b) => b.txCount - a.txCount)
    .slice(0, 6);
}

export interface WalletEntity {
  name: string;
  type: string;
  parent: string | null;
  verified: boolean;
  source: 'registry' | 'arkham';
}

// Real entity label for the analyzed wallet itself: the free on-chain registry
// resolves known EVM entities instantly; Arkham (when a key is configured)
// covers everything else. Returns null — not a guess — when neither knows it.
async function resolveWalletEntity(address: string, evm: boolean): Promise<WalletEntity | null> {
  const reg = evm && isEvmAddress(address) ? lookupEntity(address) : null;
  if (reg) return { name: reg.name, type: reg.category, parent: reg.parent ?? null, verified: true, source: 'registry' };
  try {
    const e = await getEntityByAddress(address);
    if (e?.name) return { name: e.name, type: e.type ?? 'entity', parent: null, verified: !!e.verified, source: 'arkham' };
  } catch { /* Arkham optional — ignore */ }
  return null;
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
    valueUsd: t.valueUSD !== null && t.valueUSD > 0 ? t.valueUSD.toFixed(2) : null,
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

  // Partner wallets from the real parsed Solana transfers (counterparty +
  // direction come straight off the on-chain swap/transfer parse).
  const partnerWallets = aggregatePartners(
    intel.transactions
      .filter(tx => tx.counterparty)
      .map(tx => ({ counterparty: tx.counterparty as string, inbound: tx.direction === 'in', valueUsd: tx.valueUSD ?? 0 })),
    false,
  );

  return {
    chain: 'Solana', address, holdings, totalBalanceUsd: totalBalance,
    txCount, firstSeen: intel.metadata.firstSeen, lastActive: intel.metadata.lastActive,
    txPerWeek, totalBuys: intel.metadata.totalBuys, totalSells: intel.metadata.totalSells,
    blueChipPercent: Math.round(blueChipPercent), memePercent: Math.round(memePercent),
    diversificationScore: Math.round((1 - hhi) * 100),
    archetype, archetypeDescription: archetypeDescription(archetype),
    partnerWallets,
    dataSource: intel.dataSource,
    recentTxs: intel.transactions.slice(0, 25).map(tx => ({
      hash: tx.hash, type: tx.type, asset: tx.tokenSymbol || 'SOL',
      amount: tx.amount, from: tx.counterparty || address,
      to: tx.direction === 'out' ? (tx.counterparty || '') : address,
      blockTime: tx.timestamp,
    })),
  };
}

// ─── EVM DNA Fetch (uses shared evm-intelligence.ts) ─────────────────────────
// Primary: Alchemy (paginated, with DexScreener/CoinGecko prices)
// Fallback: Zerion (multi-chain, pre-priced)

async function fetchEvmDNA(address: string) {
  const intel = await buildEvmWalletIntelligence(address, 'ethereum');

  const holdings: Holding[] = intel.tokens.map(t => ({
    symbol: t.symbol,
    name: t.name,
    balance: t.balance,
    valueUsd: t.valueUSD !== null && t.valueUSD > 0 ? t.valueUSD.toFixed(2) : null,
    contractAddress: t.contractAddress,
    logoUrl: t.logoUrl,
  }));

  const totalBalance = intel.totalBalanceUSD ?? 0;

  const blueChipValue = holdings
    .filter(h => BLUE_CHIP.has(h.symbol.toUpperCase()))
    .reduce((s, h) => s + parseFloat(h.valueUsd || '0'), 0);
  const blueChipPercent = totalBalance > 0 ? (blueChipValue / totalBalance) * 100 : 0;
  const memePercent = Math.max(0, 100 - blueChipPercent);
  const hhi = holdings.reduce((sum, h) => {
    const share = totalBalance > 0 ? parseFloat(h.valueUsd || '0') / totalBalance : 0;
    return sum + share * share;
  }, 0);

  const txCount = intel.txCount;
  // Real activity rate from the wallet's actual active span (firstSeen→
  // lastActive), NOT a fixed "÷4 weeks" assumption. Null when the window is too
  // short/unknown to bound — we report "unknown" rather than inventing a rate.
  // Buy/sell counts were previously fabricated (txCount×0.6 / ×0.4) with no
  // direction data; they are removed entirely rather than guessed.
  const spanMs = intel.firstSeen && intel.lastActive
    ? new Date(intel.lastActive).getTime() - new Date(intel.firstSeen).getTime()
    : 0;
  const weeksActive = Number.isFinite(spanMs) && spanMs > 0 ? spanMs / (7 * 24 * 3600 * 1000) : 0;
  const txPerWeek = weeksActive >= 0.5 ? Math.round((txCount / weeksActive) * 10) / 10 : null;
  const archetype = computeArchetype(txCount, txPerWeek ?? 0, memePercent, holdings.length);

  // Partner wallets from the wallet's real recent transactions — the non-self
  // side of each transfer, tallied and tagged with known-entity labels.
  const self = normalizeAddress(address);
  const partnerWallets = aggregatePartners(
    intel.transactions.map(tx => {
      const from = tx.from ? normalizeAddress(tx.from) : '';
      const to = tx.to ? normalizeAddress(tx.to) : '';
      if (from === self && to && to !== self) return { counterparty: to, inbound: false, valueUsd: tx.valueUsd ?? 0 };
      if (to === self && from && from !== self) return { counterparty: from, inbound: true, valueUsd: tx.valueUsd ?? 0 };
      return { counterparty: '', inbound: false, valueUsd: 0 };
    }),
    true,
  );

  return {
    chain: intel.chainName, address, holdings, totalBalanceUsd: totalBalance,
    txCount, firstSeen: intel.firstSeen, lastActive: intel.lastActive,
    txPerWeek,
    // EVM has no per-tx buy/sell direction here, so these are honestly null
    // (the Solana path fills real counts parsed from Helius swaps).
    totalBuys: null as number | null, totalSells: null as number | null,
    blueChipPercent: Math.round(blueChipPercent), memePercent: Math.round(memePercent),
    diversificationScore: Math.round((1 - hhi) * 100), archetype,
    archetypeDescription: archetypeDescription(archetype),
    partnerWallets,
    dataSource: intel.dataSource,
    recentTxs: intel.transactions.slice(0, 25).map(tx => ({
      hash: tx.hash, type: tx.type,
      asset: tx.asset || 'ETH',
      amount: tx.value ? parseFloat(tx.value).toFixed(4).toString() : '—',
      from: tx.from, to: tx.to || '',
      blockTime: tx.blockTime,
    })),
  };
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────

// Strip newlines / braces / quotes from token-supplied strings before they go
// into the prompt — a token symbol from an external API could otherwise carry
// an injected instruction ("}}\n\nIgnore previous instructions…").
function sanitizeForPrompt(s: string): string {
  return String(s ?? '').replace(/[\n\r{}"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24);
}

async function buildAIAnalysis(data: {
  address: string; chain: string; holdings: Holding[]; totalBalanceUsd: number;
  txCount: number; firstSeen: string | null; lastActive: string | null;
  archetype: WalletArchetype; archetypeDescription: string; txPerWeek: number | null;
  blueChipPercent: number; memePercent: number; diversificationScore: number;
}) {
  const holdingsText = data.holdings.length > 0
    ? data.holdings.slice(0, 30).map(h => `${sanitizeForPrompt(h.symbol)}: ${sanitizeForPrompt(h.balance)}${h.valueUsd ? ` ($${h.valueUsd})` : ''}`).join(', ')
    : 'No holdings detected';

  // Only GROUNDED facts go in. We do NOT pass buy/sell counts (no direction data)
  // and we do NOT ask the model to score timing/risk-management/consistency/
  // conviction — there is no entry/exit or PnL data to ground those, so asking
  // for them forced fabrication. The output contract is qualitative assessment
  // of the REAL holdings/activity only.
  const prompt = `You are a professional crypto intelligence analyst. Analyze this wallet's on-chain DNA STRICTLY from the data below. Never invent numbers, prices, PnL, win rates, or trade outcomes that are not given. If something is unknown, say "unknown" — do not estimate it. Qualitative judgments (style, strengths, risks) are allowed but must be justified by the holdings/activity shown.

Wallet: ${data.address} | Chain: ${data.chain}
Archetype (rule-based): ${data.archetype} — ${data.archetypeDescription}
Portfolio Value: $${data.totalBalanceUsd.toFixed(2)} | Holdings (${data.holdings.length} total): ${holdingsText}
TX Count: ${data.txCount} | TX/Week: ${data.txPerWeek ?? 'unknown'}
Blue Chip %: ${data.blueChipPercent}% | Meme Token %: ${data.memePercent}% | Diversification: ${data.diversificationScore}/100
First Seen: ${data.firstSeen || 'Unknown'} | Last Active: ${data.lastActive || 'Unknown'}

Return ONLY this JSON (no other fields):
{"personalityProfile":"2-3 sentences citing the real holdings/activity above","tradingStyle":"Day Trader|Swing Trader|HODLer|DeFi Farmer|Degen|Scalper","riskProfile":"Conservative|Moderate|Aggressive|Ultra Aggressive","strengths":["s1","s2","s3"],"weaknesses":["w1","w2","w3"],"recommendations":["r1","r2","r3"],"marketOutlook":"1-2 sentences, qualitative only","topInsight":"One key insight grounded in the data above","sectorBreakdown":{"memecoins":0,"defi":0,"stablecoins":0,"layer1layer2":0},"riskClassification":"DEGEN|BALANCED|CONSERVATIVE|WHALE|SMART MONEY","metrics":{"diversification":${data.diversificationScore}}}`;

  try {
    const text = await vtxAnalyze(prompt, 1800);
    if (!text) return null;
    try { return JSON.parse(text); } catch {
      const m = text.match(/\{[\s\S]*\}/);
      return m ? JSON.parse(m[0]) : null;
    }
  } catch { return null; }
}

/**
 * Grounded portfolio score — a TRANSPARENT formula over real signals, not an
 * LLM guess. Diversification (HHI-derived) + blue-chip quality + holdings
 * breadth + whether the wallet is actually active. This replaces the previously
 * LLM-invented overallScore (which varied run-to-run with no rubric).
 */
function computeGroundedScore(data: {
  diversificationScore: number; blueChipPercent: number; holdings: unknown[]; txCount: number;
}): { score: number; grade: string } {
  const diversification = Math.max(0, Math.min(100, data.diversificationScore || 0));
  const quality = Math.max(0, Math.min(100, data.blueChipPercent || 0));
  const breadth = Math.min(100, (Array.isArray(data.holdings) ? data.holdings.length : 0) * 10);
  const active = data.txCount > 0 ? 100 : 0;
  const score = Math.round(0.40 * diversification + 0.30 * quality + 0.15 * breadth + 0.15 * active);
  const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B+' : score >= 60 ? 'B'
    : score >= 50 ? 'C+' : score >= 40 ? 'C' : score >= 30 ? 'D' : 'F';
  return { score, grade };
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

// withTierGate('mini') — DNA analysis fans out to Birdeye, Alchemy
// + an Anthropic synthesis call (Sonnet 4.6, billable). Without an
// auth + tier gate, a script could iterate addresses and burn
// $150-300/day in API spend; tier-gating Pro+ caps the surface.
export const GET = withTierGate('mini', async (request: NextRequest) => {
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

    const [coinsWorthWatching, aiAnalysisRaw, entity] = await Promise.all([
      chainType === 'SOL' ? fetchCoinsWorthWatching(data.archetype, heldAddresses) : Promise.resolve([]),
      buildAIAnalysis(data),
      resolveWalletEntity(address, chainType === 'EVM'),
    ]);

    // Numbers come from CODE (transparent, grounded), narrative from the LLM.
    // We overwrite any model-supplied score/grade/metrics so the gauge can never
    // show an invented number; the only metric we expose is real diversification.
    const grounded = computeGroundedScore(data);
    const aiAnalysis = aiAnalysisRaw
      ? {
          ...(aiAnalysisRaw as Record<string, unknown>),
          overallScore: grounded.score,
          portfolioGrade: grounded.grade,
          metrics: { diversification: data.diversificationScore },
        }
      : null;

    return NextResponse.json({
      address, chain: data.chain, holdings: data.holdings, totalBalanceUsd: data.totalBalanceUsd,
      txCount: data.txCount, firstSeen: data.firstSeen, lastActive: data.lastActive,
      txPerWeek: data.txPerWeek, totalBuys: data.totalBuys, totalSells: data.totalSells,
      blueChipPercent: data.blueChipPercent, memePercent: data.memePercent,
      diversificationScore: data.diversificationScore, archetype: data.archetype,
      archetypeDescription: data.archetypeDescription, recentTransactions: data.recentTxs,
      coinsWorthWatching,
      aiAnalysis,
      entity,
      tradingStyle: (aiAnalysis as { tradingStyle?: string } | null)?.tradingStyle || data.archetype.replace(/_/g, ' '),
      riskClassification: (aiAnalysis as { riskClassification?: string } | null)?.riskClassification || 'BALANCED',
      favoriteTokens: data.holdings.slice(0, 5).map(h => h.symbol),
      partnerWallets: data.partnerWallets,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'DNA analysis failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});
