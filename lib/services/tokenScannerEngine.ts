import 'server-only';

/**
 * Token Scanner Engine
 * ────────────────────
 * The deep, explainable, multi-source composite behind the AI Scanner.
 *
 * ABSOLUTE RULE (CLAUDE.md): every flag is set by a REAL signal from a real
 * security source. No fabricated verdicts or numbers. When a source can't run
 * for a token/chain, the affected checks are returned as `status: 'unavailable'`
 * with an honest reason — never silently dropped and never defaulted to "pass".
 *
 * Sources fused here:
 *   • GoPlus token_security  — static contract-flag analysis (EVM + Solana)
 *   • Honeypot.is            — LIVE buy/sell simulation (EVM: eth/bsc/base)
 *   • DexScreener            — real market depth, pools, price, FDV (all chains)
 *   • Birdeye                — Solana on-chain security (mint/freeze/LP/top10)
 *
 * Every source is fetched independently (Promise.allSettled): a provider outage
 * degrades gracefully to "unavailable" checks instead of a failed scan.
 */

import { getTokenSecurity, SecurityRateLimitError, type TokenSecurityResult } from './goplus';
import { getHoneypotSimulation, honeypotSupported, type HoneypotResult } from './honeypot';
import { getTokenPairs, searchPairs, type DexPair } from './dexscreener';
import { getBirdeyeTokenSecurity, getBirdeyeTokenOverview, type BirdeyeTokenSecurity } from './birdeye';
import { isEvmAddress, isSolanaAddress } from '../utils/addressNormalize';

// ─── Public types ──────────────────────────────────────────────────────────────

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'unavailable';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type RiskTier = 'Critical' | 'High' | 'Medium' | 'Low' | 'Safe';
export type CheckCategory = 'Trading' | 'Ownership' | 'Contract' | 'Liquidity' | 'Holders' | 'Market' | 'Reputation';

export interface ScanCheck {
  id: string;
  label: string;
  category: CheckCategory;
  status: CheckStatus;
  severity: Severity;
  /** The real signal + value that produced this status. This is the "why". */
  evidence: string;
  /** Which provider produced the underlying signal. */
  source: string;
}

export interface SourceStatus {
  name: string;
  ok: boolean;
  /** Human reason: 'ok', 'rate-limited', 'unsupported on this chain', 'no data', 'error'. */
  detail: string;
}

export interface ScanResult {
  contract: string;
  chainId: string;
  chainLabel: string;
  resolvedChain: string;
  name: string;
  symbol: string;
  totalSupply: string;
  holderCount: number;
  creatorAddress: string;
  ownerAddress: string;

  // Composite verdict
  riskScore: number;          // 0..100, higher = safer (kept as "trustScore" too)
  trustScore: number;         // alias for backward-compat with existing UI
  riskTier: RiskTier;
  safetyLevel: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER'; // legacy field
  safetyColor: string;
  tierColor: string;
  scoreReasons: string[];     // the real signals that drove the tier, worst-first

  // Headline flags (kept for backward-compat with the existing UI)
  buyTax: string;
  sellTax: string;
  isHoneypot: boolean;
  isOpenSource: boolean;
  isMintable: boolean;
  isProxy: boolean;
  hasHiddenOwner: boolean;
  canTakeBackOwnership: boolean;
  ownerCanChangeBalance: boolean;

  // Deep, explainable data
  checks: ScanCheck[];
  sources: SourceStatus[];
  taxDetail: {
    buyTaxPct: number | null;
    sellTaxPct: number | null;
    transferTaxPct: number | null;
    source: string;
    note: string | null;
  };
  lpAnalysis: {
    status: CheckStatus;
    lockedOrBurnedPct: number | null;
    detail: string;
    source: string;
  } | null;
  reconciliation: string[];   // honest notes where sources agreed/disagreed

  lpHolders: unknown[];
  lpTotalSupply: string;
  dexData: Record<string, unknown> | null;
  timestamp: string;
  aiAnalysis?: string;
}

// ─── Chain maps ──────────────────────────────────────────────────────────────

const CHAIN_MAP: Record<string, string> = {
  ethereum: '1', eth: '1', '1': '1',
  bsc: '56', bnb: '56', '56': '56',
  polygon: '137', matic: '137', '137': '137',
  base: '8453', '8453': '8453',
  avalanche: '43114', avax: '43114', '43114': '43114',
  arbitrum: '42161', arb: '42161', '42161': '42161',
  optimism: '10', op: '10', '10': '10',
  solana: 'solana', sol: 'solana',
};

const CHAIN_ID_TO_NAME: Record<string, string> = {
  '1': 'ethereum', '56': 'bsc', '137': 'polygon', '8453': 'base',
  '42161': 'arbitrum', '10': 'optimism', '43114': 'avalanche', solana: 'solana',
};

const CHAIN_LABEL: Record<string, string> = {
  '1': 'Ethereum', '56': 'BSC', '137': 'Polygon', '8453': 'Base',
  '43114': 'Avalanche', '42161': 'Arbitrum', '10': 'Optimism', solana: 'Solana',
};

// DexScreener chainId slugs → our numeric/slug chainId.
const DEX_CHAIN_TO_ID: Record<string, string> = {
  ethereum: '1', bsc: '56', polygon: '137', base: '8453',
  arbitrum: '42161', optimism: '10', avalanche: '43114', solana: 'solana',
};

function chainSlug(chainId: string): string {
  return CHAIN_ID_TO_NAME[chainId] ?? 'ethereum';
}

// ─── Small helpers ─────────────────────────────────────────────────────────────

/** GoPlus flag strings are "1"/"0"; treat anything else as absent (unknown). */
function flag(v: unknown): boolean {
  return v === '1' || v === 1 || v === true;
}
/** True when a GoPlus flag field is present at all (so we can tell unknown apart). */
function present(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '';
}
function pct(v: unknown): number | null {
  if (!present(v)) return null;
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}
function isZeroAddr(a: string): boolean {
  const l = a.toLowerCase();
  return l === '' || l === '0x0000000000000000000000000000000000000000';
}
const BURN_ADDRS = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
  '0x0000000000000000000000000000000000000001',
]);

// ─── Resolution: turn any input (CA or symbol, any chain) into a real target ───

export interface ResolvedTarget {
  address: string;
  chainId: string;       // numeric string or 'solana'
  resolvedChain: string; // slug
  pairs: DexPair[];      // all DexScreener pairs for the token (cross-chain)
  bestPair: DexPair | null;
  resolvedFrom: 'address' | 'symbol';
  requestedChainHadPair: boolean;
}

/**
 * Robust resolver so long-tail tokens return real results instead of blanking:
 *   • Symbol input   → DexScreener search, pick deepest-liquidity pair.
 *   • Address input  → pull all pairs; if the user's chain has no pair, fall
 *                      back to the deepest-liquidity pair's actual chain so the
 *                      scan still runs against the right chain.
 *   • Solana address → forced to the solana path regardless of UI chain choice.
 */
export async function resolveTarget(input: string, requestedChain: string): Promise<ResolvedTarget> {
  const raw = input.trim();
  const reqChainId = CHAIN_MAP[requestedChain.toLowerCase()] ?? requestedChain;

  const looksEvm = isEvmAddress(raw);
  const looksSol = isSolanaAddress(raw);

  // Symbol / name → resolve via search to a concrete token address + chain.
  if (!looksEvm && !looksSol) {
    const found = await searchPairs(raw).catch(() => [] as DexPair[]);
    if (found.length === 0) {
      throw new Error(`Could not find a token matching "${raw}". Enter a contract address for an exact scan.`);
    }
    // Prefer a pair on the requested chain, else the deepest-liquidity pair.
    const reqSlug = chainSlug(reqChainId);
    const onReq = found.filter((p) => p.chainId?.toLowerCase() === reqSlug);
    const pool = (onReq.length ? onReq : found).sort(
      (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
    );
    const best = pool[0];
    const addr = best.baseToken.address;
    const chId = DEX_CHAIN_TO_ID[best.chainId?.toLowerCase() ?? ''] ?? '1';
    const allPairs = await getTokenPairs(addr).catch(() => found);
    return {
      address: addr,
      chainId: chId,
      resolvedChain: chainSlug(chId),
      pairs: allPairs.length ? allPairs : found,
      bestPair: best,
      resolvedFrom: 'symbol',
      requestedChainHadPair: onReq.length > 0,
    };
  }

  // Solana address — unambiguous, ignore any EVM chain selection.
  if (looksSol) {
    const pairs = await getTokenPairs(raw).catch(() => [] as DexPair[]);
    const sol = pairs.filter((p) => p.chainId?.toLowerCase() === 'solana');
    const best = (sol.length ? sol : pairs).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? null;
    return {
      address: raw,
      chainId: 'solana',
      resolvedChain: 'solana',
      pairs,
      bestPair: best,
      resolvedFrom: 'address',
      requestedChainHadPair: true,
    };
  }

  // EVM address — verify the token actually trades on the requested chain;
  // if not, retarget to whichever chain it really trades on.
  const pairs = await getTokenPairs(raw).catch(() => [] as DexPair[]);
  const reqSlug = chainSlug(reqChainId);
  const onReq = pairs.filter((p) => p.chainId?.toLowerCase() === reqSlug);
  let chainId = reqChainId;
  let bestPair: DexPair | null = null;
  if (onReq.length) {
    bestPair = onReq.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  } else if (pairs.length) {
    // Same address on a different chain — retarget so the scan is meaningful.
    bestPair = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    chainId = DEX_CHAIN_TO_ID[bestPair.chainId?.toLowerCase() ?? ''] ?? reqChainId;
  }
  return {
    address: raw.toLowerCase(),
    chainId,
    resolvedChain: chainSlug(chainId),
    pairs,
    bestPair,
    resolvedFrom: 'address',
    requestedChainHadPair: onReq.length > 0,
  };
}

// ─── DEX market block ──────────────────────────────────────────────────────────

function buildDexData(best: DexPair | null, pairs: DexPair[], chainId: string): Record<string, unknown> | null {
  if (!best) return null;
  const onChain = pairs.filter(
    (p) => (DEX_CHAIN_TO_ID[p.chainId?.toLowerCase() ?? ''] ?? '') === chainId,
  );
  const poolCount = onChain.length || pairs.length || 1;
  return {
    name: best.baseToken.name,
    symbol: best.baseToken.symbol,
    price: parseFloat(String(best.priceUsd ?? '0')),
    priceChange24h: best.priceChange?.h24 ?? 0,
    volume24h: best.volume?.h24 ?? 0,
    liquidity: best.liquidity?.usd ?? 0,
    fdv: best.fdv ?? 0,
    marketCap: best.marketCap ?? best.fdv ?? 0,
    dexId: best.dexId,
    pairAddress: best.pairAddress,
    poolCount,
    pairCreatedAt: best.pairCreatedAt ?? null,
    url: best.url ?? null,
    image: best.info?.imageUrl ?? null,
    websites: best.info?.websites ?? [],
    socials: best.info?.socials ?? [],
  };
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

// Max penalty a single FAIL of this severity subtracts from the 100-pt score.
// Calibrated so that active-exploit conditions (critical) dominate, while
// centralization flags that merely *enable* a future rug (medium) accumulate
// toward caution rather than instantly reading as "scam". This matches how
// mainstream scanners treat verified, deep-liquidity tokens that nonetheless
// carry mint/pause/blacklist admin powers (e.g. major stablecoins).
const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 45,
  high: 16,
  medium: 9,
  low: 4,
  info: 0,
};
// A 'warn' costs a fraction of a 'fail'.
const WARN_MULTIPLIER = 0.4;

// Hard-critical flags: if any FAILS, the token is Critical regardless of the
// rest of the scorecard (a single pure honeypot must never average out to Safe).
const HARD_CRITICAL_IDS = new Set([
  'honeypot', 'cannot_sell_all', 'cannot_buy', 'owner_change_balance',
  'selfdestruct', 'hidden_owner', 'can_take_back_ownership',
]);

function tierFromScore(score: number): RiskTier {
  if (score >= 85) return 'Safe';
  if (score >= 70) return 'Low';
  if (score >= 50) return 'Medium';
  if (score >= 30) return 'High';
  return 'Critical';
}

const TIER_COLOR: Record<RiskTier, string> = {
  Safe: '#10B981',
  Low: '#22C55E',
  Medium: '#F59E0B',
  High: '#F97316',
  Critical: '#EF4444',
};

// Legacy 4-level field the current UI still reads.
function legacyLevel(tier: RiskTier): { safetyLevel: ScanResult['safetyLevel']; safetyColor: string } {
  switch (tier) {
    case 'Safe': return { safetyLevel: 'SAFE', safetyColor: '#10B981' };
    case 'Low': return { safetyLevel: 'SAFE', safetyColor: '#10B981' };
    case 'Medium': return { safetyLevel: 'CAUTION', safetyColor: '#F59E0B' };
    case 'High': return { safetyLevel: 'WARNING', safetyColor: '#F97316' };
    case 'Critical': return { safetyLevel: 'DANGER', safetyColor: '#EF4444' };
  }
}

function computeComposite(checks: ScanCheck[]): {
  score: number;
  tier: RiskTier;
  reasons: string[];
  honeypotUnknown: boolean;
} {
  let penalty = 0;
  let hardCritical = false;
  const drivers: Array<{ w: number; text: string }> = [];

  for (const c of checks) {
    if (c.status === 'pass' || c.status === 'unavailable') continue;
    const base = SEVERITY_WEIGHT[c.severity];
    const p = c.status === 'fail' ? base : base * WARN_MULTIPLIER;
    if (p <= 0) continue;
    penalty += p;
    if (c.status === 'fail' && HARD_CRITICAL_IDS.has(c.id)) hardCritical = true;
    drivers.push({ w: p, text: `${c.label}: ${c.evidence}` });
  }

  let score = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  // Honeypot could not be determined by ANY dynamic source → never allow Safe.
  // Mirrors the false-SAFE guard in the underlying static analyzer.
  const honeypotCheck = checks.find((c) => c.id === 'honeypot');
  const honeypotUnknown = honeypotCheck?.status === 'unavailable';
  if (honeypotUnknown && score > 69) score = 69;

  let tier = tierFromScore(score);
  if (hardCritical) {
    tier = 'Critical';
    score = Math.min(score, 20);
  }

  const reasons = drivers.sort((a, b) => b.w - a.w).slice(0, 6).map((d) => d.text);
  return { score, tier, reasons, honeypotUnknown };
}

// ─── EVM check builder ─────────────────────────────────────────────────────────

interface FanoutEvm {
  sec: TokenSecurityResult | null;
  secErr: unknown;
  hp: HoneypotResult | null;
  dex: Record<string, unknown> | null;
  chainSupportsHoneypot: boolean;
}

function buildEvmChecks(f: FanoutEvm): { checks: ScanCheck[]; reconciliation: string[]; taxDetail: ScanResult['taxDetail']; lpAnalysis: ScanResult['lpAnalysis'] } {
  const checks: ScanCheck[] = [];
  const recon: string[] = [];
  const t = (f.sec?.raw ?? {}) as Record<string, unknown>;
  const goplusOk = f.sec !== null;

  const add = (c: ScanCheck) => checks.push(c);
  const gpUnavailable = (id: string, label: string, category: CheckCategory, severity: Severity): ScanCheck => ({
    id, label, category, severity, status: 'unavailable',
    evidence: f.secErr instanceof SecurityRateLimitError
      ? 'Contract-flag provider rate-limited: could not verify'
      : 'Contract-flag analysis unavailable for this token/chain',
    source: 'GoPlus',
  });

  // ── HONEYPOT (reconcile static GoPlus + live Honeypot.is sim) ────────────────
  const gpHoneypot = present(t.is_honeypot) ? flag(t.is_honeypot) : null;
  const simHoneypot = f.hp?.available ? f.hp.isHoneypot : null;
  const cannotSell = present(t.cannot_sell_all) ? flag(t.cannot_sell_all) : null;

  let honeypotStatus: CheckStatus;
  let honeypotEvidence: string;
  let honeypotSource = 'GoPlus + Live Simulation';
  const honeypotTrue = gpHoneypot === true || simHoneypot === true;
  if (honeypotTrue) {
    honeypotStatus = 'fail';
    const parts: string[] = [];
    if (gpHoneypot === true) parts.push('GoPlus static flag = honeypot');
    if (simHoneypot === true) parts.push(`live sell simulation blocked${f.hp?.honeypotReason ? ` (${f.hp.honeypotReason})` : ''}`);
    honeypotEvidence = parts.join('; ');
  } else if (gpHoneypot === false && simHoneypot === false) {
    honeypotStatus = 'pass';
    honeypotEvidence = 'GoPlus flag clear AND live buy/sell simulation succeeded';
  } else if (simHoneypot === false) {
    honeypotStatus = 'pass';
    honeypotEvidence = 'Live buy/sell simulation succeeded (sell not blocked)';
    honeypotSource = 'Live Simulation';
  } else if (gpHoneypot === false) {
    honeypotStatus = 'pass';
    honeypotEvidence = 'GoPlus static honeypot flag clear';
    honeypotSource = 'GoPlus';
  } else {
    honeypotStatus = 'unavailable';
    honeypotEvidence = f.chainSupportsHoneypot
      ? 'No tradable pool to simulate and GoPlus omitted the dynamic honeypot flag: sellability could not be verified'
      : 'Live sell-simulation not supported on this chain and GoPlus omitted the dynamic flag: sellability could not be verified';
  }
  add({ id: 'honeypot', label: 'Sellable (not a honeypot)', category: 'Trading', severity: 'critical', status: honeypotStatus, evidence: honeypotEvidence, source: honeypotSource });
  if (gpHoneypot != null && simHoneypot != null && gpHoneypot !== simHoneypot) {
    recon.push(`Honeypot signals disagree: GoPlus static = ${gpHoneypot ? 'honeypot' : 'clear'}, live simulation = ${simHoneypot ? 'honeypot' : 'sellable'}. Treated as risk (live sim is authoritative for sellability).`);
  }

  // cannot buy / cannot sell all — independent hard flags
  if (goplusOk && present(t.cannot_buy)) {
    add({ id: 'cannot_buy', label: 'Buying enabled', category: 'Trading', severity: 'critical',
      status: flag(t.cannot_buy) ? 'fail' : 'pass',
      evidence: flag(t.cannot_buy) ? 'GoPlus: buys are disabled at the contract level' : 'GoPlus: buys are not blocked', source: 'GoPlus' });
  }
  if (cannotSell === true) {
    add({ id: 'cannot_sell_all', label: 'Can sell entire balance', category: 'Trading', severity: 'critical',
      status: 'fail', evidence: 'GoPlus: cannot_sell_all, holders cannot fully exit their position', source: 'GoPlus' });
  }

  // ── TAXES (prefer live sim, cross-check static) ─────────────────────────────
  const gpBuy = pct(t.buy_tax);   // fraction
  const gpSell = pct(t.sell_tax);
  const simBuy = f.hp?.available ? f.hp.buyTax : null;
  const simSell = f.hp?.available ? f.hp.sellTax : null;
  const buyTaxPct = (simBuy ?? gpBuy);
  const sellTaxPct = (simSell ?? gpSell);
  const taxSource = simBuy != null || simSell != null ? 'Live Simulation' : (gpBuy != null || gpSell != null ? 'GoPlus' : 'unavailable');
  let taxNote: string | null = null;
  if (gpSell != null && simSell != null && Math.abs(gpSell - simSell) > 0.03) {
    taxNote = `Static sell tax ${(gpSell * 100).toFixed(1)}% vs live-simulated ${(simSell * 100).toFixed(1)}%. Live value shown.`;
    recon.push(`Sell tax differs between sources: GoPlus ${(gpSell * 100).toFixed(1)}%, live sim ${(simSell * 100).toFixed(1)}%.`);
  }

  const sellForCheck = sellTaxPct;
  if (sellForCheck != null) {
    add({ id: 'sell_tax', label: 'Sell tax under 10%', category: 'Trading',
      severity: sellForCheck > 0.15 ? 'critical' : 'high',
      status: sellForCheck > 0.10 ? 'fail' : sellForCheck > 0.05 ? 'warn' : 'pass',
      evidence: `${taxSource === 'Live Simulation' ? 'Simulated' : 'Reported'} sell tax = ${(sellForCheck * 100).toFixed(1)}%`,
      source: taxSource === 'Live Simulation' ? 'Live Simulation' : 'GoPlus' });
  } else {
    add({ id: 'sell_tax', label: 'Sell tax', category: 'Trading', severity: 'high', status: 'unavailable',
      evidence: 'No source could measure a sell tax (no tradable pool / unsupported)', source: taxSource === 'unavailable' ? 'GoPlus + Live Simulation' : taxSource });
  }
  if (buyTaxPct != null) {
    add({ id: 'buy_tax', label: 'Buy tax under 10%', category: 'Trading',
      severity: 'medium',
      status: buyTaxPct > 0.10 ? 'fail' : buyTaxPct > 0.05 ? 'warn' : 'pass',
      evidence: `${taxSource === 'Live Simulation' ? 'Simulated' : 'Reported'} buy tax = ${(buyTaxPct * 100).toFixed(1)}%`,
      source: taxSource === 'Live Simulation' ? 'Live Simulation' : 'GoPlus' });
  }

  // ── CONTRACT / OWNERSHIP ────────────────────────────────────────────────────
  if (goplusOk && present(t.is_open_source)) {
    add({ id: 'open_source', label: 'Source code verified', category: 'Contract', severity: 'high',
      status: flag(t.is_open_source) ? 'pass' : 'fail',
      evidence: flag(t.is_open_source) ? 'Verified/open-source contract on the block explorer' : 'Contract source is NOT verified: logic cannot be audited', source: 'GoPlus' });
  } else if (!goplusOk) {
    add(gpUnavailable('open_source', 'Source code verified', 'Contract', 'high'));
  }

  if (goplusOk && present(t.is_mintable)) {
    add({ id: 'mintable', label: 'Supply not mintable', category: 'Contract', severity: 'medium',
      status: flag(t.is_mintable) ? 'fail' : 'pass',
      evidence: flag(t.is_mintable) ? 'GoPlus: mint function present, owner can inflate supply' : 'No mint function: supply is fixed', source: 'GoPlus' });
  }

  if (goplusOk && present(t.is_proxy)) {
    add({ id: 'proxy', label: 'Not an upgradeable proxy', category: 'Contract', severity: 'medium',
      status: flag(t.is_proxy) ? 'warn' : 'pass',
      evidence: flag(t.is_proxy) ? 'GoPlus: proxy/upgradeable, implementation logic can be swapped by the admin' : 'Non-proxy: logic is immutable', source: 'GoPlus' });
  }

  const owner = String(t.owner_address ?? '');
  if (goplusOk) {
    const renounced = isZeroAddr(owner);
    const canReclaim = flag(t.can_take_back_ownership);
    // Critical only when a reclaim backdoor exists (fake renounce). A simply
    // retained owner with no backdoor is a caution, not a rug in itself.
    add({ id: 'can_take_back_ownership', label: 'Ownership cannot be reclaimed', category: 'Ownership',
      severity: canReclaim ? 'critical' : 'medium',
      status: canReclaim ? 'fail' : renounced ? 'pass' : 'warn',
      evidence: canReclaim ? 'GoPlus: ownership can be re-claimed after renouncing, a rug vector' : renounced ? 'Ownership renounced (owner = zero address)' : `Owner retained (${owner ? owner.slice(0, 8) + '…' : 'active'}); no reclaim backdoor detected`,
      source: 'GoPlus' });
  }

  if (goplusOk && present(t.hidden_owner)) {
    add({ id: 'hidden_owner', label: 'No hidden owner', category: 'Ownership', severity: 'critical',
      status: flag(t.hidden_owner) ? 'fail' : 'pass',
      evidence: flag(t.hidden_owner) ? 'GoPlus: hidden owner detected, real control is concealed' : 'No hidden owner detected', source: 'GoPlus' });
  }
  if (goplusOk && present(t.owner_change_balance)) {
    add({ id: 'owner_change_balance', label: 'Owner cannot modify balances', category: 'Ownership', severity: 'critical',
      status: flag(t.owner_change_balance) ? 'fail' : 'pass',
      evidence: flag(t.owner_change_balance) ? 'GoPlus: owner can arbitrarily change balances, a direct theft risk' : 'Owner cannot alter holder balances', source: 'GoPlus' });
  }
  if (goplusOk && present(t.selfdestruct)) {
    add({ id: 'selfdestruct', label: 'No self-destruct', category: 'Contract', severity: 'critical',
      status: flag(t.selfdestruct) ? 'fail' : 'pass',
      evidence: flag(t.selfdestruct) ? 'GoPlus: contract can self-destruct' : 'No self-destruct capability', source: 'GoPlus' });
  }

  // ── TRADING RESTRICTIONS (blacklist / pausable / anti-whale / cooldown) ──────
  if (goplusOk && present(t.is_blacklisted)) {
    add({ id: 'blacklist', label: 'No blacklist mechanism', category: 'Trading', severity: 'medium',
      status: flag(t.is_blacklisted) ? 'fail' : 'pass',
      evidence: flag(t.is_blacklisted) ? 'GoPlus: contract can blacklist wallets from selling' : 'No blacklist function', source: 'GoPlus' });
  }
  if (goplusOk && present(t.transfer_pausable)) {
    add({ id: 'transfer_pausable', label: 'Transfers not pausable', category: 'Trading', severity: 'medium',
      status: flag(t.transfer_pausable) ? 'fail' : 'pass',
      evidence: flag(t.transfer_pausable) ? 'GoPlus: owner can pause ALL transfers (freeze trading)' : 'Transfers cannot be paused', source: 'GoPlus' });
  }
  if (goplusOk && (present(t.slippage_modifiable) || present(t.personal_slippage_modifiable))) {
    const modifiable = flag(t.slippage_modifiable) || flag(t.personal_slippage_modifiable);
    add({ id: 'tax_modifiable', label: 'Tax rate not owner-modifiable', category: 'Trading', severity: 'high',
      status: modifiable ? 'fail' : 'pass',
      evidence: modifiable ? 'GoPlus: owner can change the trading tax at any time (can be set to 100% = soft honeypot)' : 'Tax rate is fixed', source: 'GoPlus' });
  }
  if (goplusOk && present(t.is_anti_whale) && flag(t.is_anti_whale) && present(t.anti_whale_modifiable)) {
    add({ id: 'anti_whale_modifiable', label: 'Max-tx limit not owner-modifiable', category: 'Trading', severity: 'medium',
      status: flag(t.anti_whale_modifiable) ? 'warn' : 'pass',
      evidence: flag(t.anti_whale_modifiable) ? 'GoPlus: owner can change the max transaction/wallet limit' : 'Anti-whale limit is fixed', source: 'GoPlus' });
  }
  if (goplusOk && present(t.trading_cooldown) && flag(t.trading_cooldown)) {
    add({ id: 'trading_cooldown', label: 'No trading cooldown', category: 'Trading', severity: 'medium',
      status: 'warn', evidence: 'GoPlus: a cooldown between trades is enforced', source: 'GoPlus' });
  }
  if (goplusOk && present(t.external_call) && flag(t.external_call)) {
    add({ id: 'external_call', label: 'No risky external calls', category: 'Contract', severity: 'low',
      status: 'warn', evidence: 'GoPlus: contract makes external calls that can change behavior', source: 'GoPlus' });
  }
  if (goplusOk && present(t.is_airdrop_scam) && flag(t.is_airdrop_scam)) {
    add({ id: 'airdrop_scam', label: 'Not a known airdrop scam', category: 'Reputation', severity: 'high',
      status: 'fail', evidence: 'GoPlus: flagged as an airdrop-scam token', source: 'GoPlus' });
  }

  // ── LP LOCKED / BURNED (from GoPlus lp_holders) ─────────────────────────────
  let lpAnalysis: ScanResult['lpAnalysis'] = null;
  const lpHolders = Array.isArray(t.lp_holders) ? (t.lp_holders as Array<Record<string, unknown>>) : [];
  if (goplusOk && lpHolders.length > 0) {
    let lockedOrBurned = 0;
    let burnedShare = 0;
    let lockedShare = 0;
    for (const h of lpHolders) {
      const share = pct(h.percent) ?? 0; // 0..1
      const addr = String(h.address ?? '').toLowerCase();
      const tag = String(h.tag ?? '').toLowerCase();
      const isBurn = BURN_ADDRS.has(addr) || tag.includes('burn') || tag.includes('null') || tag.includes('dead');
      const isLocked = flag(h.is_locked) || tag.includes('lock');
      if (isBurn) { burnedShare += share; lockedOrBurned += share; }
      else if (isLocked) { lockedShare += share; lockedOrBurned += share; }
    }
    const pctLocked = Math.round(lockedOrBurned * 100);
    const status: CheckStatus = pctLocked >= 90 ? 'pass' : pctLocked >= 50 ? 'warn' : 'fail';
    const parts: string[] = [];
    if (burnedShare > 0) parts.push(`${Math.round(burnedShare * 100)}% burned`);
    if (lockedShare > 0) parts.push(`${Math.round(lockedShare * 100)}% locked`);
    const detail = parts.length ? parts.join(' + ') : 'LP appears fully unlocked/held';
    lpAnalysis = { status, lockedOrBurnedPct: pctLocked, detail, source: 'GoPlus' };
    add({ id: 'lp_locked', label: 'LP locked or burned', category: 'Liquidity',
      severity: status === 'fail' ? 'high' : 'medium', status,
      evidence: `${pctLocked}% of LP secured (${detail}). Unsecured LP can be pulled by the owner`, source: 'GoPlus' });
  } else if (goplusOk) {
    // No LP-holder data — mark unavailable rather than implying it's unlocked.
    add({ id: 'lp_locked', label: 'LP locked or burned', category: 'Liquidity', severity: 'medium', status: 'unavailable',
      evidence: 'No LP-holder breakdown available from the security provider for this token', source: 'GoPlus' });
  }

  // ── HOLDER CONCENTRATION + DEV HOLDINGS ─────────────────────────────────────
  if (goplusOk && f.sec) {
    const topPct = f.sec.topHolderPct; // 0..1, largest single holder
    if (topPct > 0) {
      add({ id: 'top_holder', label: 'Top holder concentration', category: 'Holders',
        severity: topPct > 0.5 ? 'high' : 'medium',
        status: topPct > 0.5 ? 'fail' : topPct > 0.25 ? 'warn' : 'pass',
        evidence: `Largest single holder controls ${(topPct * 100).toFixed(1)}% of supply`, source: 'GoPlus' });
    }
    if (f.sec.creatorIsTopHolder) {
      const cp = f.sec.creatorHoldingPct;
      add({ id: 'dev_holding', label: 'Dev wallet not over-weighted', category: 'Holders',
        severity: cp > 0.05 ? 'high' : 'medium',
        status: cp > 0.05 ? 'fail' : cp > 0.02 ? 'warn' : 'pass',
        evidence: `Creator wallet holds ${(cp * 100).toFixed(1)}% of supply: dump risk`, source: 'GoPlus' });
    }
  }

  const taxDetail: ScanResult['taxDetail'] = {
    buyTaxPct, sellTaxPct, transferTaxPct: f.hp?.available ? f.hp.transferTax : null,
    source: taxSource, note: taxNote,
  };

  return { checks, reconciliation: recon, taxDetail, lpAnalysis };
}

// ─── Solana check builder ──────────────────────────────────────────────────────

interface FanoutSol {
  sec: TokenSecurityResult | null;    // GoPlus solana parse
  bird: BirdeyeTokenSecurity | null;
  dex: Record<string, unknown> | null;
}

function buildSolanaChecks(f: FanoutSol): { checks: ScanCheck[]; reconciliation: string[]; lpAnalysis: ScanResult['lpAnalysis'] } {
  const checks: ScanCheck[] = [];
  const recon: string[] = [];
  const add = (c: ScanCheck) => checks.push(c);
  const t = (f.sec?.raw ?? {}) as Record<string, unknown>;
  const goplusOk = f.sec !== null;
  const birdOk = f.bird !== null;

  const statusObj = (v: unknown): boolean => {
    if (v && typeof v === 'object' && 'status' in v) return flag((v as { status: unknown }).status);
    return flag(v);
  };

  // MINT AUTHORITY — cross-check GoPlus + Birdeye
  const gpMint = goplusOk && present((t as Record<string, unknown>).mintable) ? statusObj(t.mintable) : null;
  const bMint = birdOk ? (f.bird!.isMintable ?? null) : null;
  const mintable = gpMint === true || bMint === true;
  if (gpMint != null || bMint != null) {
    add({ id: 'mintable', label: 'Mint authority revoked', category: 'Contract', severity: 'high',
      status: mintable ? 'fail' : 'pass',
      evidence: mintable
        ? `Active mint authority: supply can be inflated${bMint === true && gpMint === true ? ' (confirmed by two sources)' : ''}`
        : 'Mint authority revoked: supply is fixed',
      source: gpMint != null && bMint != null ? 'GoPlus + Birdeye' : gpMint != null ? 'GoPlus' : 'Birdeye' });
    if (gpMint != null && bMint != null && gpMint !== bMint) {
      recon.push(`Mint-authority signals disagree (GoPlus=${gpMint}, Birdeye=${bMint}); treated as risk.`);
    }
  } else {
    add({ id: 'mintable', label: 'Mint authority revoked', category: 'Contract', severity: 'high', status: 'unavailable',
      evidence: 'Neither on-chain security source returned mint-authority state', source: 'GoPlus + Birdeye' });
  }

  // FREEZE AUTHORITY
  const gpFreeze = goplusOk && present(t.freezable) ? statusObj(t.freezable) : null;
  const bFreeze = birdOk ? (f.bird!.freezeable ?? null) : null;
  const freezable = gpFreeze === true || bFreeze === true;
  if (gpFreeze != null || bFreeze != null) {
    add({ id: 'freezable', label: 'Freeze authority revoked', category: 'Contract', severity: 'high',
      status: freezable ? 'fail' : 'pass',
      evidence: freezable ? 'Active freeze authority: token accounts can be frozen (transfers blocked)' : 'Freeze authority revoked',
      source: gpFreeze != null && bFreeze != null ? 'GoPlus + Birdeye' : gpFreeze != null ? 'GoPlus' : 'Birdeye' });
  } else {
    add({ id: 'freezable', label: 'Freeze authority revoked', category: 'Contract', severity: 'high', status: 'unavailable',
      evidence: 'Freeze-authority state unavailable from on-chain sources', source: 'GoPlus + Birdeye' });
  }

  // NON-TRANSFERABLE = hard honeypot analogue for SPL
  if (goplusOk && present(t.non_transferable)) {
    const nt = statusObj(t.non_transferable);
    add({ id: 'cannot_sell_all', label: 'Token is transferable', category: 'Trading', severity: 'critical',
      status: nt ? 'fail' : 'pass',
      evidence: nt ? 'GoPlus: token is non-transferable, cannot be sold/moved' : 'Token transfers are enabled', source: 'GoPlus' });
  }

  // METADATA MUTABLE / CLOSABLE
  if (goplusOk && present(t.metadata_mutable)) {
    add({ id: 'metadata_mutable', label: 'Metadata immutable', category: 'Contract', severity: 'low',
      status: statusObj(t.metadata_mutable) ? 'warn' : 'pass',
      evidence: statusObj(t.metadata_mutable) ? 'Token metadata can still be changed by an authority' : 'Metadata is immutable', source: 'GoPlus' });
  }
  if (goplusOk && present(t.closable)) {
    add({ id: 'closable', label: 'Account not closable', category: 'Contract', severity: 'medium',
      status: statusObj(t.closable) ? 'warn' : 'pass',
      evidence: statusObj(t.closable) ? 'An authority can close token accounts' : 'Token accounts cannot be force-closed', source: 'GoPlus' });
  }

  // LP BURNED (Birdeye)
  let lpAnalysis: ScanResult['lpAnalysis'] = null;
  if (birdOk && f.bird!.lpBurned !== undefined) {
    const burned = f.bird!.lpBurned === true;
    lpAnalysis = { status: burned ? 'pass' : 'warn', lockedOrBurnedPct: burned ? 100 : null, detail: burned ? 'LP tokens burned' : 'LP not reported as burned', source: 'Birdeye' };
    add({ id: 'lp_locked', label: 'LP burned', category: 'Liquidity', severity: 'medium',
      status: burned ? 'pass' : 'warn',
      evidence: burned ? 'Birdeye: LP tokens are burned, liquidity cannot be pulled' : 'Birdeye: LP is not burned, pull risk if unlocked', source: 'Birdeye' });
  } else {
    add({ id: 'lp_locked', label: 'LP burned', category: 'Liquidity', severity: 'medium', status: 'unavailable',
      evidence: 'LP burn state unavailable from on-chain source', source: 'Birdeye' });
  }

  // TOP-10 HOLDER CONCENTRATION (Birdeye) / largest holder (GoPlus)
  const top10 = birdOk ? (f.bird!.top10HolderPercent ?? null) : null;
  if (top10 != null) {
    add({ id: 'top_holder', label: 'Top-10 holder concentration', category: 'Holders',
      severity: top10 > 80 ? 'high' : 'medium',
      status: top10 > 80 ? 'fail' : top10 > 60 ? 'warn' : 'pass',
      evidence: `Top 10 wallets hold ${top10.toFixed(1)}% of supply`, source: 'Birdeye' });
  } else if (goplusOk && f.sec && f.sec.topHolderPct > 0) {
    const tp = f.sec.topHolderPct;
    add({ id: 'top_holder', label: 'Top holder concentration', category: 'Holders',
      severity: tp > 0.5 ? 'high' : 'medium',
      status: tp > 0.5 ? 'fail' : tp > 0.25 ? 'warn' : 'pass',
      evidence: `Largest holder controls ${(tp * 100).toFixed(1)}% of supply`, source: 'GoPlus' });
  } else {
    add({ id: 'top_holder', label: 'Holder concentration', category: 'Holders', severity: 'medium', status: 'unavailable',
      evidence: 'Holder-distribution data unavailable for this token', source: 'GoPlus + Birdeye' });
  }

  return { checks, reconciliation: recon, lpAnalysis };
}

// ─── Orchestrator ──────────────────────────────────────────────────────────────

export async function runDeepScan(target: ResolvedTarget): Promise<ScanResult> {
  const { address, chainId, resolvedChain } = target;
  const isSolana = chainId === 'solana';
  const dexData = buildDexData(target.bestPair, target.pairs, chainId);

  let checks: ScanCheck[] = [];
  let reconciliation: string[] = [];
  let taxDetail: ScanResult['taxDetail'] = { buyTaxPct: null, sellTaxPct: null, transferTaxPct: null, source: 'unavailable', note: null };
  let lpAnalysis: ScanResult['lpAnalysis'] = null;
  const sources: SourceStatus[] = [];

  let name = (dexData?.name as string) || 'Unknown Token';
  let symbol = (dexData?.symbol as string) || '???';
  let totalSupply = 'N/A';
  let holderCount = 0;
  let creatorAddress = 'N/A';
  let ownerAddress = 'N/A';
  let sec: TokenSecurityResult | null = null;

  if (isSolana) {
    const [secR, birdR, ovR] = await Promise.allSettled([
      getTokenSecurity(address, 'solana'),
      getBirdeyeTokenSecurity(address),
      getBirdeyeTokenOverview(address, 'solana'),
    ]);
    sec = secR.status === 'fulfilled' ? secR.value : null;
    const bird = birdR.status === 'fulfilled' ? birdR.value : null;
    const ov = ovR.status === 'fulfilled' ? ovR.value : null;

    sources.push({ name: 'GoPlus', ok: sec !== null, detail: sec !== null ? 'ok' : 'no data' });
    sources.push({ name: 'Birdeye', ok: bird !== null, detail: bird !== null ? 'ok' : 'no data' });
    sources.push({ name: 'DexScreener', ok: dexData !== null, detail: dexData !== null ? 'ok' : 'no data' });

    const built = buildSolanaChecks({ sec, bird, dex: dexData });
    checks = built.checks;
    reconciliation = built.reconciliation;
    lpAnalysis = built.lpAnalysis;

    holderCount = ov?.holder ?? sec?.holderCount ?? 0;
    creatorAddress = bird?.creatorAddress || sec?.creatorAddress || 'N/A';
    ownerAddress = bird?.ownerAddress || 'N/A';
    name = ov?.name || name;
    symbol = ov?.symbol || symbol;
  } else {
    const chainSupportsHoneypot = honeypotSupported(address, resolvedChain);
    const [secR, hpR] = await Promise.allSettled([
      getTokenSecurity(address, resolvedChain),
      chainSupportsHoneypot ? getHoneypotSimulation(address, resolvedChain) : Promise.resolve(null),
    ]);
    sec = secR.status === 'fulfilled' ? secR.value : null;
    const secErr = secR.status === 'rejected' ? secR.reason : null;
    const hp = hpR.status === 'fulfilled' ? hpR.value : null;

    sources.push({
      name: 'GoPlus',
      ok: sec !== null,
      detail: sec !== null ? 'ok' : (secErr instanceof SecurityRateLimitError ? 'rate-limited' : 'error'),
    });
    sources.push({
      name: 'Live Simulation',
      ok: hp?.available === true,
      detail: !chainSupportsHoneypot ? 'unsupported on this chain' : hp?.available ? 'ok' : (hp?.unavailableReason ?? 'no data'),
    });
    sources.push({ name: 'DexScreener', ok: dexData !== null, detail: dexData !== null ? 'ok' : 'no data' });

    const built = buildEvmChecks({ sec, secErr, hp, dex: dexData, chainSupportsHoneypot });
    checks = built.checks;
    reconciliation = built.reconciliation;
    taxDetail = built.taxDetail;
    lpAnalysis = built.lpAnalysis;

    if (sec) {
      name = sec.raw?.token_name || sec.raw?.name || name;
      symbol = sec.raw?.token_symbol || sec.raw?.symbol || symbol;
      totalSupply = sec.raw?.total_supply || 'N/A';
      holderCount = sec.holderCount || (hp?.holderCount ?? 0);
      creatorAddress = sec.creatorAddress || 'N/A';
      ownerAddress = sec.ownerAddress || 'N/A';
    } else if (hp?.available) {
      name = hp.tokenName || name;
      symbol = hp.tokenSymbol || symbol;
      holderCount = hp.holderCount ?? 0;
    }
  }

  // ── LIQUIDITY / MARKET context checks (DexScreener, all chains) ─────────────
  if (dexData) {
    const liq = (dexData.liquidity as number) ?? 0;
    const fdv = (dexData.fdv as number) ?? 0;
    const vol = (dexData.volume24h as number) ?? 0;
    checks.push({
      id: 'liquidity', label: 'Sufficient liquidity', category: 'Market',
      severity: liq < 10_000 ? 'high' : 'medium',
      status: liq >= 50_000 ? 'pass' : liq >= 10_000 ? 'warn' : 'fail',
      evidence: `$${Math.round(liq).toLocaleString()} pooled liquidity across ${(dexData.poolCount as number) ?? 1} pool(s)`, source: 'DexScreener',
    });
    if (fdv > 0 && liq > 0) {
      const ratio = liq / fdv;
      checks.push({
        id: 'lp_fdv', label: 'Liquidity backs valuation', category: 'Market',
        severity: 'medium',
        status: ratio >= 0.1 ? 'pass' : ratio >= 0.03 ? 'warn' : 'fail',
        evidence: `Liquidity is ${(ratio * 100).toFixed(1)}% of the $${Math.round(fdv).toLocaleString()} FDV${ratio < 0.03 ? ': thin backing = exit-liquidity risk' : ''}`,
        source: 'DexScreener',
      });
    }
    checks.push({
      id: 'volume', label: 'Active trading volume', category: 'Market', severity: 'low',
      status: vol >= 10_000 ? 'pass' : vol > 0 ? 'warn' : 'fail',
      evidence: `$${Math.round(vol).toLocaleString()} traded in the last 24h`, source: 'DexScreener',
    });
  } else {
    checks.push({
      id: 'liquidity', label: 'Sufficient liquidity', category: 'Market', severity: 'high', status: 'unavailable',
      evidence: 'No DEX pair found: token may be unlisted, pre-launch, or on an unsupported venue', source: 'DexScreener',
    });
  }

  // ── COMPOSITE ──────────────────────────────────────────────────────────────
  const { score, tier, reasons } = computeComposite(checks);
  const { safetyLevel, safetyColor } = legacyLevel(tier);

  // Convenience booleans for the legacy UI (from the deep checks).
  const failed = (id: string) => checks.some((c) => c.id === id && c.status === 'fail');
  const val = (id: string) => checks.find((c) => c.id === id)?.status;

  return {
    contract: address,
    chainId,
    chainLabel: CHAIN_LABEL[chainId] ?? resolvedChain,
    resolvedChain,
    name, symbol, totalSupply, holderCount, creatorAddress, ownerAddress,
    riskScore: score,
    trustScore: score,
    riskTier: tier,
    safetyLevel, safetyColor,
    tierColor: TIER_COLOR[tier],
    scoreReasons: reasons,
    buyTax: taxDetail.buyTaxPct != null ? `${(taxDetail.buyTaxPct * 100).toFixed(1)}%` : 'N/A',
    sellTax: taxDetail.sellTaxPct != null ? `${(taxDetail.sellTaxPct * 100).toFixed(1)}%` : 'N/A',
    isHoneypot: failed('honeypot') || failed('cannot_sell_all'),
    isOpenSource: val('open_source') === 'pass',
    isMintable: failed('mintable'),
    isProxy: val('proxy') === 'warn',
    hasHiddenOwner: failed('hidden_owner'),
    canTakeBackOwnership: failed('can_take_back_ownership'),
    ownerCanChangeBalance: failed('owner_change_balance') || failed('freezable'),
    checks,
    sources,
    taxDetail,
    lpAnalysis,
    reconciliation,
    lpHolders: sec?.lpHolders ?? [],
    lpTotalSupply: (sec?.raw?.lp_total_supply as string) || 'N/A',
    dexData: dexData ?? null,
    timestamp: new Date().toISOString(),
  };
}
