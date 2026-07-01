import 'server-only';
import {
  getTokenApprovals,
  getPermit2Approvals,
  getNftApprovals,
  getTokenBalances,
  getAssetTransfers,
} from '@/lib/services/alchemy';
import { getTokenSecurity } from '@/lib/services/goplus';
import { checkOfac } from '@/lib/security/ofac';
import { enrichAddress } from '@/lib/security/addressEnrich';
import { normalizeAddress, isEvmChain, isEvmAddress } from '@/lib/utils/addressNormalize';

/**
 * Shareable wallet health score (Webacy-style primitive).
 *
 * Computes a TRANSPARENT 0..100 health score for ANY looked-up EVM wallet from
 * real, independently-sourced signals. Every sub-score is derived in code from
 * live data. When a source is unavailable we mark that sub-score `available:false`
 * and EXCLUDE it from the weighting rather than fabricate a value, so the headline
 * score is an honest weighted average of only the components we could actually
 * measure. `coverage` reports what fraction of the intended weight we covered.
 *
 * Signals:
 *   approvals   0.35  open risky ERC-20 / Permit2 / NFT-operator grants
 *                     (from the same on-chain approvals engine as /security/approvals)
 *   honeypot    0.30  honeypot / high-tax exposure across the wallet's real holdings (GoPlus)
 *   sanctions   0.20  OFAC SDN hit (Chainalysis public list) — hard zero on a hit
 *   activity    0.15  wallet age + transaction history (Alchemy asset transfers)
 *
 * Higher score = healthier. A sanctions hit floors the entire composite to 0
 * regardless of the other components (compliance overrides).
 */

export type HealthChain = string;

export interface HealthSubScore {
  /** Sub-score 0..100 (100 = healthiest). Null when unavailable. */
  score: number | null;
  /** Weight this component carries in the composite when available. */
  weight: number;
  /** False when the underlying source failed / was unreachable → excluded from composite. */
  available: boolean;
  /** Short human explanation of what this sub-score measured. */
  detail: string;
}

export interface WalletHealthResult {
  address: string;
  chain: HealthChain;
  /** Honest weighted 0..100 composite over AVAILABLE components. Null when nothing could be measured. */
  score: number | null;
  /** Coarse band derived from the composite. */
  band: 'healthy' | 'moderate' | 'risky' | 'critical' | 'unknown';
  /** Fraction (0..1) of intended weight actually covered by available sources. */
  coverage: number;
  components: {
    approvals: HealthSubScore;
    honeypot: HealthSubScore;
    sanctions: HealthSubScore;
    activity: HealthSubScore;
  };
  /** Concrete real signals behind the score, for the UI to show (never fabricated). */
  signals: {
    riskyApprovals: number;
    unlimitedApprovals: number;
    totalApprovals: number;
    honeypotTokens: number;
    highTaxTokens: number;
    holdingsScanned: number;
    sanctioned: boolean;
    walletAgeDays: number | null;
    txCount: number | null;
  };
  /** Human-readable notes about degraded / unavailable sources. */
  notes: string[];
  computedAt: string;
}

const WEIGHTS = { approvals: 0.35, honeypot: 0.30, sanctions: 0.20, activity: 0.15 } as const;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function bandFor(score: number | null): WalletHealthResult['band'] {
  if (score === null) return 'unknown';
  if (score >= 80) return 'healthy';
  if (score >= 55) return 'moderate';
  if (score >= 30) return 'risky';
  return 'critical';
}

/**
 * Approvals sub-score. Reuses the same on-chain approval engine the
 * /api/security/approvals route uses (ERC-20 + Permit2 + NFT operator), then
 * penalizes for open exposure: flagged/malicious spenders weigh heaviest,
 * unlimited grants next, live NFT-operator and Permit2 grants a smaller amount.
 */
async function scoreApprovals(address: string, chain: string): Promise<{
  sub: HealthSubScore;
  riskyApprovals: number;
  unlimitedApprovals: number;
  totalApprovals: number;
}> {
  const [erc20S, permit2S, nftS] = await Promise.allSettled([
    getTokenApprovals(address, chain),
    getPermit2Approvals(address, chain),
    getNftApprovals(address, chain),
  ]);

  // If EVERY scan failed we cannot honestly score approvals.
  if (erc20S.status === 'rejected' && permit2S.status === 'rejected' && nftS.status === 'rejected') {
    return {
      sub: { score: null, weight: WEIGHTS.approvals, available: false, detail: 'Approval scan unavailable' },
      riskyApprovals: 0, unlimitedApprovals: 0, totalApprovals: 0,
    };
  }

  const erc20 = erc20S.status === 'fulfilled' ? erc20S.value : [];
  const permit2 = permit2S.status === 'fulfilled' ? permit2S.value : [];
  const nft = nftS.status === 'fulfilled' ? nftS.value : [];

  const UNLIMITED_THRESHOLD = BigInt(2) ** BigInt(255);
  const isUnlimited = (raw: string): boolean => {
    try { return BigInt(raw) >= UNLIMITED_THRESHOLD; } catch { return false; }
  };

  // Enrich the distinct spenders once to detect malicious / flagged targets.
  const spenders = Array.from(new Set([
    ...erc20.map(a => a.spender),
    ...permit2.map(a => a.spender),
    ...nft.map(a => a.operator),
  ]));
  const enrichMap = new Map<string, boolean>();
  await Promise.all(spenders.map(async (s) => {
    try {
      const e = await enrichAddress(s, chain);
      enrichMap.set(normalizeAddress(s, chain), !!(e.isMalicious || e.isPhishing || e.isBlacklisted));
    } catch { /* leave unflagged — honest unknown, not a false positive */ }
  }));
  const flagged = (s: string) => enrichMap.get(normalizeAddress(s, chain)) === true;

  let penalty = 0;
  let risky = 0;
  let unlimited = 0;

  for (const a of erc20) {
    const unl = isUnlimited(a.allowance);
    if (flagged(a.spender)) { penalty += 45; risky++; }
    else if (unl) { penalty += 12; }
    if (unl) unlimited++;
  }
  for (const a of permit2) {
    const unl = isUnlimited(a.amount);
    if (flagged(a.spender)) { penalty += 45; risky++; }
    else { penalty += unl ? 14 : 6; } // live spendable grant carries standing exposure
    if (unl) unlimited++;
  }
  for (const a of nft) {
    // An operator grant can move EVERY token in the collection.
    if (flagged(a.operator)) { penalty += 45; risky++; }
    else { penalty += 10; }
    unlimited++;
  }

  const score = clamp(100 - penalty, 0, 100);
  const total = erc20.length + permit2.length + nft.length;
  const partial = erc20S.status === 'rejected' || permit2S.status === 'rejected' || nftS.status === 'rejected';

  return {
    sub: {
      score,
      weight: WEIGHTS.approvals,
      available: true,
      detail: total === 0
        ? 'No open approvals'
        : `${total} open approval${total === 1 ? '' : 's'}, ${risky} on flagged spenders${partial ? ' (partial scan)' : ''}`,
    },
    riskyApprovals: risky,
    unlimitedApprovals: unlimited,
    totalApprovals: total,
  };
}

/**
 * Honeypot / tax-exposure sub-score. Scans the wallet's REAL non-zero ERC-20
 * holdings through GoPlus and penalizes honeypots and punitive-tax tokens the
 * wallet is actually exposed to. Bounded to the top holdings to keep the call
 * budget sane; degrades honestly if no holding could be scanned.
 */
async function scoreHoneypot(address: string, chain: string): Promise<{
  sub: HealthSubScore;
  honeypotTokens: number;
  highTaxTokens: number;
  holdingsScanned: number;
}> {
  let balances: Awaited<ReturnType<typeof getTokenBalances>>;
  try {
    balances = await getTokenBalances(address, chain);
  } catch {
    return {
      sub: { score: null, weight: WEIGHTS.honeypot, available: false, detail: 'Holdings lookup unavailable' },
      honeypotTokens: 0, highTaxTokens: 0, holdingsScanned: 0,
    };
  }

  const held = balances.filter((b) => {
    try { return BigInt(b.tokenBalance || '0') > BigInt(0); } catch { return false; }
  });

  if (held.length === 0) {
    return {
      sub: { score: 100, weight: WEIGHTS.honeypot, available: true, detail: 'No fungible token holdings to expose' },
      honeypotTokens: 0, highTaxTokens: 0, holdingsScanned: 0,
    };
  }

  // Bound the fan-out. GoPlus is rate-limited; scanning the wallet's holdings
  // top-down covers the meaningful exposure without hammering the provider.
  const CAP = 25;
  const targets = held.slice(0, CAP);

  const results = await Promise.allSettled(
    targets.map((t) => getTokenSecurity(t.contractAddress, chain)),
  );

  let scanned = 0;
  let honeypots = 0;
  let highTax = 0;
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    scanned++;
    const s = r.value;
    if (s.isHoneypot || s.cannotSellAll || s.cannotBuy) honeypots++;
    else if ((s.sellTax ?? 0) > 0.10 || (s.buyTax ?? 0) > 0.10) highTax++;
  }

  if (scanned === 0) {
    return {
      sub: { score: null, weight: WEIGHTS.honeypot, available: false, detail: 'Token security scan unavailable' },
      honeypotTokens: 0, highTaxTokens: 0, holdingsScanned: 0,
    };
  }

  // Each honeypot in the wallet is a serious exposure; high-tax is a lighter hit.
  const penalty = honeypots * 40 + highTax * 12;
  const score = clamp(100 - penalty, 0, 100);

  return {
    sub: {
      score,
      weight: WEIGHTS.honeypot,
      available: true,
      detail: honeypots === 0 && highTax === 0
        ? `${scanned} holding${scanned === 1 ? '' : 's'} scanned, none flagged`
        : `${honeypots} honeypot, ${highTax} high-tax across ${scanned} scanned`,
    },
    honeypotTokens: honeypots,
    highTaxTokens: highTax,
    holdingsScanned: scanned,
  };
}

/**
 * Sanctions sub-score. A confirmed OFAC SDN hit floors the component to 0 (and
 * the composite too, applied by the caller). `unavailable` from the upstream is
 * NOT treated as clean here — we mark the component unavailable so the honest
 * "partial score" path excludes it rather than implying a clean compliance check.
 */
async function scoreSanctions(address: string): Promise<{ sub: HealthSubScore; sanctioned: boolean }> {
  const res = await checkOfac(address);
  if (res.source === 'unavailable') {
    return {
      sub: { score: null, weight: WEIGHTS.sanctions, available: false, detail: 'OFAC check unavailable' },
      sanctioned: false,
    };
  }
  if (res.sanctioned) {
    const name = res.identifications[0]?.name;
    return {
      sub: { score: 0, weight: WEIGHTS.sanctions, available: true, detail: name ? `OFAC sanctioned: ${name}` : 'OFAC sanctioned address' },
      sanctioned: true,
    };
  }
  return {
    sub: { score: 100, weight: WEIGHTS.sanctions, available: true, detail: 'No OFAC SDN match' },
    sanctioned: false,
  };
}

/**
 * Activity sub-score from wallet age + transaction history. A brand-new wallet
 * with almost no history is riskier (fresh drainer / burner pattern); a wallet
 * with real age and sustained activity scores high. Derived from Alchemy asset
 * transfers (outbound direction), which carry block timestamps.
 */
async function scoreActivity(address: string, chain: string): Promise<{
  sub: HealthSubScore;
  walletAgeDays: number | null;
  txCount: number | null;
}> {
  let transfers: Awaited<ReturnType<typeof getAssetTransfers>>;
  try {
    transfers = await getAssetTransfers(address, chain, 'from', 1000);
  } catch {
    return {
      sub: { score: null, weight: WEIGHTS.activity, available: false, detail: 'Activity history unavailable' },
      walletAgeDays: null, txCount: null,
    };
  }

  const txCount = transfers.length;
  const timestamps = transfers.map((t) => t.timestamp).filter((t): t is number => typeof t === 'number');
  const oldest = timestamps.length ? Math.min(...timestamps) : null;
  const ageDays = oldest !== null ? Math.max(0, Math.floor((Date.now() / 1000 - oldest) / 86_400)) : null;

  // Age component: 0 days → 0, ramping to full at ~180 days.
  const ageScore = ageDays === null ? 40 : clamp((ageDays / 180) * 100, 0, 100);
  // Activity component: 0 tx → 0, ramping to full at ~50 outbound tx.
  const actScore = clamp((txCount / 50) * 100, 0, 100);
  // A wallet with zero outbound history at all is a hard low signal.
  const score = txCount === 0 ? 20 : Math.round(ageScore * 0.6 + actScore * 0.4);

  return {
    sub: {
      score,
      weight: WEIGHTS.activity,
      available: true,
      detail: ageDays === null
        ? `${txCount} outbound tx, age unknown`
        : `~${ageDays}d old, ${txCount} outbound tx`,
    },
    walletAgeDays: ageDays,
    txCount,
  };
}

/**
 * Compute the full shareable wallet-health result for an EVM address. Only EVM
 * is supported today (the approvals + GoPlus token engines are EVM-scoped);
 * Solana returns an honest unknown so the caller can degrade gracefully.
 */
export async function computeWalletHealth(rawAddress: string, chain: string): Promise<WalletHealthResult> {
  const address = rawAddress.trim();
  const computedAt = new Date().toISOString();
  const notes: string[] = [];

  const emptyComponent = (weight: number, detail: string): HealthSubScore => ({
    score: null, weight, available: false, detail,
  });

  // Non-EVM (or malformed) addresses: the approvals + token-security engines are
  // EVM-only. Return an honest unknown rather than a fabricated score.
  if (!isEvmChain(chain) || !isEvmAddress(address)) {
    return {
      address, chain,
      score: null,
      band: 'unknown',
      coverage: 0,
      components: {
        approvals: emptyComponent(WEIGHTS.approvals, 'EVM only'),
        honeypot: emptyComponent(WEIGHTS.honeypot, 'EVM only'),
        sanctions: emptyComponent(WEIGHTS.sanctions, 'EVM only'),
        activity: emptyComponent(WEIGHTS.activity, 'EVM only'),
      },
      signals: {
        riskyApprovals: 0, unlimitedApprovals: 0, totalApprovals: 0,
        honeypotTokens: 0, highTaxTokens: 0, holdingsScanned: 0,
        sanctioned: false, walletAgeDays: null, txCount: null,
      },
      notes: ['Wallet health scoring currently supports EVM chains only.'],
      computedAt,
    };
  }

  const [approvals, honeypot, sanctions, activity] = await Promise.all([
    scoreApprovals(address, chain),
    scoreHoneypot(address, chain),
    scoreSanctions(address),
    scoreActivity(address, chain),
  ]);

  const components = {
    approvals: approvals.sub,
    honeypot: honeypot.sub,
    sanctions: sanctions.sub,
    activity: activity.sub,
  };

  for (const [name, c] of Object.entries(components)) {
    if (!c.available) notes.push(`${name} component unavailable (${c.detail}).`);
  }

  // Honest weighted average over ONLY the components we could measure.
  const available = Object.values(components).filter((c) => c.available && c.score !== null);
  const totalWeight = available.reduce((s, c) => s + c.weight, 0);
  let composite: number | null = null;
  if (totalWeight > 0) {
    const weighted = available.reduce((s, c) => s + (c.score as number) * c.weight, 0);
    composite = Math.round(weighted / totalWeight);
  }

  // Compliance override: a confirmed OFAC hit floors the whole composite.
  if (sanctions.sanctioned) {
    composite = 0;
    notes.push('Composite floored to 0 by OFAC sanctions match.');
  }

  const intendedWeight = WEIGHTS.approvals + WEIGHTS.honeypot + WEIGHTS.sanctions + WEIGHTS.activity;
  const coverage = intendedWeight > 0 ? totalWeight / intendedWeight : 0;

  return {
    address, chain,
    score: composite,
    band: bandFor(composite),
    coverage: Math.round(coverage * 100) / 100,
    components,
    signals: {
      riskyApprovals: approvals.riskyApprovals,
      unlimitedApprovals: approvals.unlimitedApprovals,
      totalApprovals: approvals.totalApprovals,
      honeypotTokens: honeypot.honeypotTokens,
      highTaxTokens: honeypot.highTaxTokens,
      holdingsScanned: honeypot.holdingsScanned,
      sanctioned: sanctions.sanctioned,
      walletAgeDays: activity.walletAgeDays,
      txCount: activity.txCount,
    },
    notes,
    computedAt,
  };
}
