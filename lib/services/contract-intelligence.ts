import 'server-only';
import { cache, TTL } from '../api/cache-manager';
import { getContractSource, getContractCreation, getERC20TokenInfo, getTopERC20Holders } from './etherscan';
import { getTokenSecurity } from './goplus';
import { getTokenPairs, getTokensMulti } from './dexscreener';
import { getBirdeyeTokenOverview, getBirdeyeHolders } from './birdeye';
import { getSolanaTokenHolders, getSolanaTokenMeta } from './alchemy-solana';
import { getTokenHolders as getArkhamHolders, getAddressIntel } from './arkham';

// ─── Chain Detection ───────────────────────────────────────────────────────────

export function detectChainType(address: string): 'EVM' | 'SOL' | 'UNKNOWN' {
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) return 'EVM';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return 'SOL';
  return 'UNKNOWN';
}

// ─── Contract Type Classifier ─────────────────────────────────────────────────

function classifyContractType(
  name: string,
  symbol: string,
  liquidity: number,
  marketCap: number,
  dexId: string | null
): ContractIntelligence['type'] {
  const n = (name + ' ' + symbol).toLowerCase();
  const hasLp = n.includes('lp') || n.includes('pool') || n.includes('pair') || dexId?.includes('swap');
  if (hasLp) return 'LP';
  const memeKeywords = ['pepe', 'doge', 'shib', 'inu', 'moon', 'elon', 'chad', 'wojak', 'frog', 'meme', 'bonk', 'floki'];
  if (memeKeywords.some(k => n.includes(k))) return 'meme';
  if (liquidity > 500_000 && marketCap > 5_000_000) return 'token';
  if (liquidity > 0) return 'token';
  return 'unknown';
}

// ─── Holder Classification ─────────────────────────────────────────────────────

const EXCHANGE_NAMES = ['binance', 'coinbase', 'kraken', 'okx', 'bybit', 'kucoin', 'huobi', 'gate', 'bitfinex', 'gemini', 'bitstamp', 'crypto.com'];
const DEX_NAMES = ['uniswap', 'sushiswap', 'pancake', 'curve', 'raydium', 'orca', 'jupiter', 'balancer', 'camelot', 'trader joe'];

function classifyHolderType(name: string, labels: string[]): ContractHolder['type'] {
  const n = name.toLowerCase();
  const l = labels.map(x => x.toLowerCase());
  if (l.some(x => ['scammer', 'rug_puller', 'phishing', 'hack', 'exploit'].includes(x))) return 'scammer';
  if (l.some(x => ['team', 'deployer', 'creator', 'treasury', 'vesting'].includes(x))) return 'team';
  if (l.some(x => ['dex', 'amm', 'liquidity_pool', 'lp'].includes(x))) return 'dex';
  if (EXCHANGE_NAMES.some(e => n.includes(e))) return 'exchange';
  if (DEX_NAMES.some(d => n.includes(d))) return 'dex';
  if (n.includes('contract') || n.includes('multisig') || n.includes('gnosis') || n.includes('safe')) return 'contract';
  return 'whale';
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ContractSecurity {
  riskScore: number;
  riskLevel: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER';
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  ownershipRenounced: boolean;
  isMintable: boolean;
  isProxy: boolean;
  hasHiddenOwner: boolean;
  blacklistStatus: boolean;
  checks: Array<{ label: string; status: 'pass' | 'fail' | 'warn' }>;
  creatorAddress: string | null;
  ownerAddress: string | null;
}

export interface ContractMarket {
  priceUSD: number;
  priceChange24h: number;
  liquidity: number;
  volume24h: number;
  marketCap: number;
  fdv: number;
  pairAddress: string | null;
  dexId: string | null;
  pairCreatedAt: number | null;
  logoURI: string | null;
}

export interface ContractHolder {
  address: string;
  label: string;
  percentage: number;
  type: 'exchange' | 'whale' | 'contract' | 'dex' | 'team' | 'scammer' | 'unknown';
  entityName: string | null;
  entityLabel: string | null;
  entityBadge: string | null;
  verified: boolean;
  isScammer: boolean;
}

export interface ContractIntelligence {
  address: string;
  chain: string;
  chainType: 'EVM' | 'SOL';
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string | null;
  type: 'token' | 'LP' | 'meme' | 'utility' | 'unknown';
  verified: boolean;
  creatorAddress: string | null;
  creationTxHash: string | null;
  security: ContractSecurity;
  market: ContractMarket;
  holders: ContractHolder[];
  metadata: {
    sourceVerified: boolean;
    holderCount: number;
    topHolderConcentration: number;
    lastUpdated: string;
    dataSource: string;
  };
}

// ─── EVM Contract Builder ──────────────────────────────────────────────────────

async function buildEvmContractIntelligence(
  address: string,
  chain: string
): Promise<ContractIntelligence> {
  // STEP 1: Parallel — all data sources at once
  const [sourceResult, creationResult, tokenInfoResult, dexPairsResult, securityResult, holdersResult, birdeyeResult] =
    await Promise.allSettled([
      getContractSource(address, chain),
      getContractCreation(address, chain),
      getERC20TokenInfo(address, chain),
      getTokenPairs(address),
      getTokenSecurity(address, chain),
      getTopERC20Holders(address, 20),
      getBirdeyeTokenOverview(address, chain),
    ]);

  // STEP 2: Extract results with safe fallbacks
  const source = sourceResult.status === 'fulfilled' ? sourceResult.value : null;
  const creation = creationResult.status === 'fulfilled' ? creationResult.value : null;
  const tokenInfo = tokenInfoResult.status === 'fulfilled' ? tokenInfoResult.value : null;
  const dexPairs = dexPairsResult.status === 'fulfilled' ? dexPairsResult.value : [];
  const security = securityResult.status === 'fulfilled' ? securityResult.value : null;
  const ethplorerHolders = holdersResult.status === 'fulfilled' ? holdersResult.value : [];
  const birdeye = birdeyeResult.status === 'fulfilled' ? birdeyeResult.value : null;

  // STEP 3: Best DexScreener pair (highest liquidity)
  const bestPair = dexPairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? null;

  // STEP 4: Merge token name/symbol — priority: DexScreener > Etherscan tokeninfo > GoPlus
  const name = bestPair?.baseToken?.name || tokenInfo?.name || source?.contractName || 'Unknown Token';
  const symbol = bestPair?.baseToken?.symbol || tokenInfo?.symbol || '';
  const decimals = tokenInfo?.decimals ?? 18;

  // STEP 5: Market data — DexScreener primary, Birdeye fallback
  const market: ContractMarket = {
    priceUSD: bestPair ? parseFloat(bestPair.priceUsd || '0') : (birdeye?.price ?? 0),
    priceChange24h: bestPair?.priceChange?.h24 ?? birdeye?.priceChange24hPercent ?? 0,
    liquidity: bestPair?.liquidity?.usd ?? birdeye?.liquidity ?? 0,
    volume24h: bestPair?.volume?.h24 ?? birdeye?.volume24h ?? 0,
    marketCap: bestPair?.fdv ?? birdeye?.marketCap ?? 0,
    fdv: bestPair?.fdv ?? 0,
    pairAddress: bestPair?.pairAddress ?? null,
    dexId: bestPair?.dexId ?? null,
    pairCreatedAt: bestPair?.pairCreatedAt ?? null,
    logoURI: bestPair?.info?.imageUrl ?? birdeye?.logoURI ?? null,
  };

  // STEP 6: Security object
  const ownerRenounced = !security?.ownerAddress ||
    security.ownerAddress === '0x0000000000000000000000000000000000000000' ||
    !security.canTakeBackOwnership;

  const secObj: ContractSecurity = {
    riskScore: security?.trustScore ?? 50,
    riskLevel: security?.safetyLevel ?? 'CAUTION',
    isHoneypot: security?.isHoneypot ?? false,
    buyTax: security?.buyTax ?? 0,
    sellTax: security?.sellTax ?? 0,
    ownershipRenounced: ownerRenounced,
    isMintable: security?.isMintable ?? false,
    isProxy: security?.isProxy ?? source?.isProxy ?? false,
    hasHiddenOwner: security?.hasHiddenOwner ?? false,
    blacklistStatus: false,  // GoPlus doesn't expose this directly at token level
    checks: security?.checks ?? [
      { label: 'Contract Verified', status: source?.verified ? 'pass' : 'fail' },
      { label: 'Security Data', status: 'warn' },
    ],
    creatorAddress: security?.creatorAddress || creation?.creatorAddress || null,
    ownerAddress: security?.ownerAddress || null,
  };

  // STEP 7: Holders — Ethplorer with Arkham enrichment for top 10
  const arkhamIntelMap = new Map<string, { entityName: string | null; entityType: string | null; labels: string[]; isScammer: boolean }>();
  if (ethplorerHolders.length > 0 && process.env.ARKHAM_API_KEY) {
    const top10 = ethplorerHolders.slice(0, 10).map(h => h.address);
    const intelResults = await Promise.allSettled(top10.map(addr => getAddressIntel(addr)));
    top10.forEach((addr, i) => {
      const r = intelResults[i];
      if (r.status === 'fulfilled') {
        const intel = r.value;
        arkhamIntelMap.set(addr.toLowerCase(), {
          entityName: intel.arkhamEntity?.name ?? null,
          entityType: intel.arkhamEntity?.type ?? null,
          labels: intel.labels ?? [],
          isScammer: (intel.labels ?? []).some(l =>
            ['scammer', 'rug_puller', 'phishing', 'hack', 'exploit'].includes(l.toLowerCase())
          ),
        });
      }
    });
  }

  const holders: ContractHolder[] = ethplorerHolders.map(h => {
    const intel = arkhamIntelMap.get(h.address.toLowerCase());
    const entityName = intel?.entityName ?? null;
    const labels = intel?.labels ?? [];
    const isScammer = intel?.isScammer ?? false;
    const displayName = entityName || `${h.address.slice(0, 6)}...${h.address.slice(-4)}`;
    const holderType = isScammer ? 'scammer' : classifyHolderType(displayName, labels);
    const entityLabel = holderType === 'exchange' ? 'CEX' : holderType === 'dex' ? 'Protocol' : holderType === 'team' ? 'Team' : null;
    const entityBadge = entityLabel ? (entityLabel === 'CEX' ? 'CEX' : entityLabel === 'Protocol' ? 'PRO' : '!') : null;

    return {
      address: h.address,
      label: displayName,
      percentage: Math.round(h.share * 100) / 100,
      type: holderType,
      entityName,
      entityLabel,
      entityBadge,
      verified: !!entityName,
      isScammer,
    } satisfies ContractHolder;
  });

  const topHolderConcentration = holders
    .slice(0, 5)
    .reduce((sum, h) => sum + h.percentage, 0);

  return {
    address,
    chain,
    chainType: 'EVM',
    name,
    symbol,
    decimals,
    totalSupply: tokenInfo?.totalSupply ?? null,
    type: classifyContractType(name, symbol, market.liquidity, market.marketCap, market.dexId),
    verified: source?.verified ?? false,
    creatorAddress: secObj.creatorAddress,
    creationTxHash: creation?.txHash ?? null,
    security: secObj,
    market,
    holders,
    metadata: {
      sourceVerified: source?.verified ?? false,
      holderCount: security?.holderCount ?? holders.length,
      topHolderConcentration: Math.round(topHolderConcentration * 100) / 100,
      lastUpdated: new Date().toISOString(),
      dataSource: 'etherscan+goplus+dexscreener+birdeye',
    },
  };
}

// ─── Solana Contract Builder ───────────────────────────────────────────────────

async function buildSolContractIntelligence(
  address: string
): Promise<ContractIntelligence> {
  // STEP 1: Parallel — all sources at once
  const [solanaMetaResult, goPlusResult, dexPairsResult, birdeyeResult, birdeyeHoldersResult, solanaHoldersResult] =
    await Promise.allSettled([
      getSolanaTokenMeta(address),
      getTokenSecurity(address, 'solana'),
      getTokenPairs(address),
      getBirdeyeTokenOverview(address, 'solana'),
      getBirdeyeHolders(address, 25, 'solana'),
      getSolanaTokenHolders(address),
    ]);

  const solanaMeta = solanaMetaResult.status === 'fulfilled' ? solanaMetaResult.value : null;
  const security = goPlusResult.status === 'fulfilled' ? goPlusResult.value : null;
  const dexPairs = dexPairsResult.status === 'fulfilled' ? dexPairsResult.value : [];
  const birdeye = birdeyeResult.status === 'fulfilled' ? birdeyeResult.value : null;
  const birdeyeHolders = birdeyeHoldersResult.status === 'fulfilled' ? birdeyeHoldersResult.value : [];
  const solanaHolders = solanaHoldersResult.status === 'fulfilled' ? solanaHoldersResult.value : [];

  const bestPair = dexPairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? null;

  // Name / symbol resolution: DexScreener > Birdeye > Helius
  const name = bestPair?.baseToken?.name || birdeye?.name || solanaMeta?.name || 'Unknown Token';
  const symbol = bestPair?.baseToken?.symbol || birdeye?.symbol || solanaMeta?.symbol || '';
  const decimals = birdeye?.decimals || solanaMeta?.decimals || 0;

  const market: ContractMarket = {
    priceUSD: bestPair ? parseFloat(bestPair.priceUsd || '0') : (birdeye?.price ?? 0),
    priceChange24h: bestPair?.priceChange?.h24 ?? birdeye?.priceChange24hPercent ?? 0,
    liquidity: bestPair?.liquidity?.usd ?? birdeye?.liquidity ?? 0,
    volume24h: bestPair?.volume?.h24 ?? birdeye?.volume24h ?? 0,
    marketCap: bestPair?.fdv ?? birdeye?.marketCap ?? 0,
    fdv: bestPair?.fdv ?? 0,
    pairAddress: bestPair?.pairAddress ?? null,
    dexId: bestPair?.dexId ?? null,
    pairCreatedAt: bestPair?.pairCreatedAt ?? null,
    logoURI: bestPair?.info?.imageUrl ?? birdeye?.logoURI ?? solanaMeta?.logoUrl ?? null,
  };

  // GoPlus Solana security
  const secObj: ContractSecurity = {
    riskScore: security?.trustScore ?? 50,
    riskLevel: security?.safetyLevel ?? 'CAUTION',
    isHoneypot: security?.isHoneypot ?? false,
    buyTax: security?.buyTax ?? 0,
    sellTax: security?.sellTax ?? 0,
    ownershipRenounced: !security?.creatorAddress,
    isMintable: security?.isMintable ?? false,
    isProxy: false,
    hasHiddenOwner: security?.hasHiddenOwner ?? false,
    blacklistStatus: false,
    checks: security?.checks ?? [],
    creatorAddress: security?.creatorAddress || null,
    ownerAddress: security?.ownerAddress || null,
  };

  // Build holders: prefer Birdeye (has percentages + owner addresses) > Helius large accounts
  let holders: ContractHolder[] = [];

  if (birdeyeHolders.length > 0) {
    const totalSupply = birdeyeHolders.reduce((s, h) => s + h.uiAmount, 0) || 1;
    holders = birdeyeHolders
      .filter(h => h.uiAmount > 0)
      .map(h => {
        const pct = Math.round((h.uiAmount / totalSupply) * 10000) / 100;
        const short = `${h.owner.slice(0, 6)}...${h.owner.slice(-4)}`;
        return {
          address: h.owner,
          label: short,
          percentage: pct,
          type: classifyHolderType(short, []) as ContractHolder['type'],
          entityName: null,
          entityLabel: null,
          entityBadge: null,
          verified: false,
          isScammer: false,
        } satisfies ContractHolder;
      });
  } else if (solanaHolders.length > 0) {
    holders = solanaHolders.map(h => ({
      address: h.address,
      label: `${h.address.slice(0, 6)}...${h.address.slice(-4)}`,
      percentage: h.percentage,
      type: 'whale' as const,
      entityName: null,
      entityLabel: null,
      entityBadge: null,
      verified: false,
      isScammer: false,
    }));
  }

  const topHolderConcentration = holders
    .slice(0, 5)
    .reduce((sum, h) => sum + h.percentage, 0);

  return {
    address,
    chain: 'solana',
    chainType: 'SOL',
    name,
    symbol,
    decimals,
    totalSupply: null,
    type: classifyContractType(name, symbol, market.liquidity, market.marketCap, market.dexId),
    verified: false, // Solana programs don't have "verified source" like EVM
    creatorAddress: secObj.creatorAddress,
    creationTxHash: null,
    security: secObj,
    market,
    holders,
    metadata: {
      sourceVerified: false,
      holderCount: birdeye?.holder ?? holders.length,
      topHolderConcentration: Math.round(topHolderConcentration * 100) / 100,
      lastUpdated: new Date().toISOString(),
      dataSource: 'alchemy+goplus+dexscreener+birdeye',
    },
  };
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function buildContractIntelligence(
  address: string,
  chainHint = 'ethereum'
): Promise<ContractIntelligence> {
  const cacheKey = `contract-intel:${chainHint}:${address.toLowerCase()}`;
  const hit = cache.get<ContractIntelligence>(cacheKey);
  if (hit) return hit;

  const chainType = detectChainType(address);

  let result: ContractIntelligence;
  if (chainType === 'SOL') {
    result = await buildSolContractIntelligence(address);
  } else {
    result = await buildEvmContractIntelligence(address, chainHint);
  }

  // Cache: 2 min for mutable market data; security data TTL drives re-validation
  cache.set(cacheKey, result, TTL.GENERAL);
  return result;
}

// ─── Risk Score → Risk Level Utility ─────────────────────────────────────────

export function riskScoreToLevel(score: number): ContractSecurity['riskLevel'] {
  if (score >= 70) return 'SAFE';
  if (score >= 50) return 'CAUTION';
  if (score >= 30) return 'WARNING';
  return 'DANGER';
}

export function topHolderRisk(concentration: number): {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  riskColor: string;
} {
  if (concentration < 40) return { riskScore: Math.round((concentration / 40) * 3), riskLevel: 'LOW', riskColor: '#10B981' };
  if (concentration < 60) return { riskScore: 3 + Math.round(((concentration - 40) / 20) * 3), riskLevel: 'MEDIUM', riskColor: '#F59E0B' };
  if (concentration < 80) return { riskScore: 6 + Math.round(((concentration - 60) / 20) * 2), riskLevel: 'HIGH', riskColor: '#F97316' };
  return { riskScore: Math.min(10, 8 + Math.round(((concentration - 80) / 20) * 2)), riskLevel: 'EXTREME', riskColor: '#EF4444' };
}
