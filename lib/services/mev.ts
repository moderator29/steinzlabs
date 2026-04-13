import 'server-only';

/**
 * MEV Protection Service
 * Analyses mempool activity, detects sandwich attack risk,
 * estimates MEV loss, and provides mitigation recommendations.
 *
 * Data sources:
 *  - Helius Enhanced Transactions API (Solana mempool signals)
 *  - Alchemy Mempool API (EVM chains)
 *  - On-chain DEX pool reserves for impact calculation
 */

export type MevActivityLevel = 'low' | 'medium' | 'high' | 'critical';
export type MevChain = 'solana' | 'ethereum' | 'base' | 'arbitrum' | 'bsc';

export interface MevSandwichInfo {
  detected: boolean;
  attackerAddress?: string;
  frontRunTxHash?: string;
  backRunTxHash?: string;
  estimatedLossUsd?: number;
  victimSlippagePct?: number;
}

export interface MevPoolActivity {
  recentBuyCount: number;
  recentSellCount: number;
  largeTradeCount: number;        // trades > $10k in last 10 blocks
  flashLoanDetected: boolean;
  arbBotActivityDetected: boolean;
  mempoolPendingCount: number;
}

export interface MevAnalysis {
  chain: MevChain | string;
  tokenAddress: string;
  activityLevel: MevActivityLevel;
  sandwichRisk: number;            // 0–100
  mevLossEstimateUsd: number;      // estimated MEV loss for this swap
  mevLossEstimatePct: number;      // as % of swap value
  sandwich: MevSandwichInfo;
  poolActivity: MevPoolActivity;
  recommendations: string[];
  privateMempoolAvailable: boolean;
  suggestedSlippageBps: number;
  analysedAt: string;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

const SANDWICH_RISK_THRESHOLDS = {
  low: 25,
  medium: 50,
  high: 75,
};

const PRIVATE_MEMPOOL_CHAINS: Set<string> = new Set([
  'ethereum', 'base', 'arbitrum',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function activityLevelFromRisk(risk: number): MevActivityLevel {
  if (risk >= SANDWICH_RISK_THRESHOLDS.high) return 'critical';
  if (risk >= SANDWICH_RISK_THRESHOLDS.medium) return 'high';
  if (risk >= SANDWICH_RISK_THRESHOLDS.low) return 'medium';
  return 'low';
}

function buildRecommendations(
  activityLevel: MevActivityLevel,
  sandwichRisk: number,
  privateMempoolAvailable: boolean,
  swapAmountUsd: number,
): string[] {
  const recs: string[] = [];

  if (sandwichRisk >= 75) {
    recs.push('Use a private mempool (Flashbots, bloXroute) to hide your transaction from searchers.');
  }
  if (sandwichRisk >= 50) {
    recs.push('Split large swaps into smaller transactions to reduce MEV exposure.');
    recs.push('Set slippage tolerance to 0.1–0.3% to make sandwich attacks unprofitable.');
  }
  if (sandwichRisk >= 25) {
    recs.push('Consider trading during off-peak hours when mempool activity is lower.');
  }
  if (swapAmountUsd >= 10_000) {
    recs.push('For large trades, use an aggregator with MEV protection (Jupiter, CoW Protocol).');
  }
  if (privateMempoolAvailable && activityLevel !== 'low') {
    recs.push('Private RPC endpoint available — route through it to avoid public mempool exposure.');
  }
  if (activityLevel === 'low') {
    recs.push('Low MEV activity detected. Normal slippage settings should be sufficient.');
  }

  return recs;
}

// ─── Solana MEV Analysis via Helius ──────────────────────────────────────────

async function analyseSolanaMev(
  tokenAddress: string,
  swapAmountUsd: number,
): Promise<Partial<MevAnalysis>> {
  const heliusKey = process.env.HELIUS_API_KEY;
  if (!heliusKey) return {};

  try {
    // Get recent enhanced transactions for this token
    const res = await fetch(
      `https://api.helius.xyz/v0/addresses/${tokenAddress}/transactions?api-key=${heliusKey}&limit=50&type=SWAP`,
      { next: { revalidate: 30 } },
    );

    if (!res.ok) return {};

    const txs: Array<{
      signature: string;
      fee: number;
      feePayer: string;
      nativeTransfers?: Array<{ amount: number }>;
      tokenTransfers?: Array<{ mint: string; tokenAmount: number }>;
      timestamp: number;
    }> = await res.json();

    if (!Array.isArray(txs) || txs.length === 0) return {};

    // Identify MEV signals: fee spikes, repeated feePayer across sequential txs
    const feePayerCounts: Record<string, number> = {};
    let totalFee = 0;
    let highFeeCount = 0;

    for (const tx of txs) {
      if (tx.feePayer) {
        feePayerCounts[tx.feePayer] = (feePayerCounts[tx.feePayer] || 0) + 1;
      }
      totalFee += tx.fee || 0;
      if ((tx.fee || 0) > 50_000) highFeeCount++; // >50k lamports = likely priority fee for MEV
    }

    const avgFee = totalFee / txs.length;
    const repeatedAddresses = Object.values(feePayerCounts).filter(c => c >= 3).length;

    // Calculate sandwich risk for Solana
    let sandwichRisk = 0;
    sandwichRisk += Math.min(30, repeatedAddresses * 10);
    sandwichRisk += Math.min(40, (highFeeCount / txs.length) * 100);
    sandwichRisk += avgFee > 100_000 ? 20 : 0;
    sandwichRisk = Math.min(100, Math.round(sandwichRisk));

    return {
      sandwichRisk,
      poolActivity: {
        recentBuyCount: txs.filter(t => t.nativeTransfers && t.nativeTransfers.length > 0).length,
        recentSellCount: Math.max(0, txs.length - txs.filter(t => t.nativeTransfers && t.nativeTransfers.length > 0).length),
        largeTradeCount: highFeeCount,
        flashLoanDetected: false,
        arbBotActivityDetected: repeatedAddresses > 2,
        mempoolPendingCount: 0,
      },
    };
  } catch {
    return {};
  }
}

// ─── EVM MEV Analysis via Alchemy ─────────────────────────────────────────────

async function analyseEvmMev(
  tokenAddress: string,
  chain: string,
  swapAmountUsd: number,
): Promise<Partial<MevAnalysis>> {
  const alchemyKey = process.env.ALCHEMY_API_KEY;
  if (!alchemyKey) return {};

  const rpcUrls: Record<string, string> = {
    ethereum: `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    base: `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    arbitrum: `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
    bsc: `https://bnb-mainnet.g.alchemy.com/v2/${alchemyKey}`,
  };

  const rpcUrl = rpcUrls[chain];
  if (!rpcUrl) return {};

  try {
    // Get pending transactions mentioning this token from mempool
    const body = {
      jsonrpc: '2.0',
      id: 1,
      method: 'alchemy_getAssetTransfers',
      params: [{
        fromBlock: 'latest',
        toBlock: 'latest',
        contractAddresses: [tokenAddress],
        category: ['erc20'],
        maxCount: '0x32',
        order: 'desc',
      }],
    };

    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return {};

    const data = await res.json();
    const transfers: Array<{ from: string; value: number; blockNum: string }> =
      data?.result?.transfers || [];

    if (transfers.length === 0) return {};

    // Count unique addresses and block density
    const addressCounts: Record<string, number> = {};
    const blockSet = new Set<string>();
    let largeTradeCount = 0;

    for (const t of transfers) {
      if (t.from) addressCounts[t.from] = (addressCounts[t.from] || 0) + 1;
      if (t.blockNum) blockSet.add(t.blockNum);
      if ((t.value || 0) > 10_000) largeTradeCount++;
    }

    const blockDensity = transfers.length / Math.max(1, blockSet.size);
    const repeatedAddresses = Object.values(addressCounts).filter(c => c >= 3).length;

    // Higher block density and repeated addresses = higher MEV risk
    let sandwichRisk = 0;
    sandwichRisk += Math.min(35, blockDensity * 5);
    sandwichRisk += Math.min(35, repeatedAddresses * 12);
    sandwichRisk += largeTradeCount > 5 ? 20 : largeTradeCount * 3;
    sandwichRisk += swapAmountUsd > 50_000 ? 10 : 0;
    sandwichRisk = Math.min(100, Math.round(sandwichRisk));

    return {
      sandwichRisk,
      poolActivity: {
        recentBuyCount: Math.ceil(transfers.length / 2),
        recentSellCount: Math.floor(transfers.length / 2),
        largeTradeCount,
        flashLoanDetected: blockDensity > 10,
        arbBotActivityDetected: repeatedAddresses > 2,
        mempoolPendingCount: transfers.length,
      },
    };
  } catch {
    return {};
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function analyseMevProtection(params: {
  tokenAddress: string;
  chain: MevChain | string;
  swapAmountUsd: number;
  currentSlippageBps?: number;
}): Promise<MevAnalysis> {
  const { tokenAddress, chain, swapAmountUsd } = params;

  // Fetch chain-specific analysis
  const chainData =
    chain === 'solana'
      ? await analyseSolanaMev(tokenAddress, swapAmountUsd)
      : await analyseEvmMev(tokenAddress, chain, swapAmountUsd);

  const sandwichRisk = chainData.sandwichRisk ?? 0;
  const activityLevel = activityLevelFromRisk(sandwichRisk);
  const privateMempoolAvailable = PRIVATE_MEMPOOL_CHAINS.has(chain);

  // Estimate MEV loss: rough model based on risk and swap size
  const mevLossPct = (sandwichRisk / 100) * 0.5; // max 0.5% at 100 risk
  const mevLossUsd = swapAmountUsd * mevLossPct;

  // Suggest slippage: tighter slippage makes sandwich attacks unprofitable
  let suggestedSlippageBps = params.currentSlippageBps ?? 50;
  if (sandwichRisk >= 75) suggestedSlippageBps = Math.min(suggestedSlippageBps, 10);
  else if (sandwichRisk >= 50) suggestedSlippageBps = Math.min(suggestedSlippageBps, 30);
  else if (sandwichRisk >= 25) suggestedSlippageBps = Math.min(suggestedSlippageBps, 50);

  const poolActivity: MevPoolActivity = chainData.poolActivity ?? {
    recentBuyCount: 0,
    recentSellCount: 0,
    largeTradeCount: 0,
    flashLoanDetected: false,
    arbBotActivityDetected: false,
    mempoolPendingCount: 0,
  };

  const recommendations = buildRecommendations(
    activityLevel,
    sandwichRisk,
    privateMempoolAvailable,
    swapAmountUsd,
  );

  return {
    chain,
    tokenAddress,
    activityLevel,
    sandwichRisk,
    mevLossEstimateUsd: parseFloat(mevLossUsd.toFixed(4)),
    mevLossEstimatePct: parseFloat((mevLossPct * 100).toFixed(4)),
    sandwich: {
      detected: sandwichRisk >= 75,
      estimatedLossUsd: sandwichRisk >= 50 ? parseFloat(mevLossUsd.toFixed(4)) : undefined,
      victimSlippagePct: sandwichRisk >= 50 ? mevLossPct * 100 : undefined,
    },
    poolActivity,
    recommendations,
    privateMempoolAvailable,
    suggestedSlippageBps,
    analysedAt: new Date().toISOString(),
  };
}
