import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';

const SOLANA_RPC = HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

function detectChain(address: string): 'EVM' | 'SOL' | 'UNKNOWN' {
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) return 'EVM';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return 'SOL';
  return 'UNKNOWN';
}

async function fetchEvmTransactions(address: string, rpcUrl: string): Promise<any[]> {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getAssetTransfers',
        params: [{
          fromAddress: address,
          category: ['external', 'erc20', 'erc721', 'erc1155'],
          maxCount: '0x32',
          order: 'desc',
        }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.result?.transfers || [];
  } catch {
    return [];
  }
}

async function fetchSolTransactions(address: string): Promise<any[]> {
  try {
    const res = await fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [address, { limit: 50 }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.result || [];
  } catch {
    return [];
  }
}

function calcTradingStats(txs: any[], chain: 'EVM' | 'SOL') {
  if (!txs || txs.length === 0) {
    return {
      txCount: 0,
      firstSeen: null,
      lastActive: null,
      totalVolume: 0,
      avgHoldTime: null,
      winRate: null,
      tradingStyle: 'Unknown',
      favoriteTokens: [],
      partnerWallets: [],
    };
  }

  const txCount = txs.length;

  // timestamps
  let firstSeen: Date | null = null;
  let lastActive: Date | null = null;

  if (chain === 'EVM') {
    const timestamps = txs
      .filter((t) => t.metadata?.blockTimestamp)
      .map((t) => new Date(t.metadata.blockTimestamp).getTime());
    if (timestamps.length > 0) {
      firstSeen = new Date(Math.min(...timestamps));
      lastActive = new Date(Math.max(...timestamps));
    }
  } else {
    const timestamps = txs
      .filter((t) => t.blockTime)
      .map((t) => t.blockTime * 1000);
    if (timestamps.length > 0) {
      firstSeen = new Date(Math.min(...timestamps));
      lastActive = new Date(Math.max(...timestamps));
    }
  }

  // partner wallets (counterparties)
  const counterpartyCount: Record<string, number> = {};
  const counterpartyVolume: Record<string, number> = {};

  if (chain === 'EVM') {
    for (const tx of txs) {
      const to = tx.to?.toLowerCase();
      const from = tx.from?.toLowerCase();
      const value = parseFloat(tx.value || '0');
      if (to && to !== 'null') {
        counterpartyCount[to] = (counterpartyCount[to] || 0) + 1;
        counterpartyVolume[to] = (counterpartyVolume[to] || 0) + value;
      }
      if (from && from !== 'null') {
        counterpartyCount[from] = (counterpartyCount[from] || 0) + 1;
        counterpartyVolume[from] = (counterpartyVolume[from] || 0) + value;
      }
    }
  }

  const partnerWallets = Object.entries(counterpartyCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([addr, count]) => ({
      address: addr,
      txCount: count,
      volume: (counterpartyVolume[addr] || 0).toFixed(4),
      label: 'Unknown',
    }));

  // favorite tokens
  const tokenFreq: Record<string, number> = {};
  if (chain === 'EVM') {
    for (const tx of txs) {
      const asset = tx.asset || tx.rawContract?.address || 'ETH';
      tokenFreq[asset] = (tokenFreq[asset] || 0) + 1;
    }
  }

  const favoriteTokens = Object.entries(tokenFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([token]) => token);

  // trading style heuristic from timespan
  let tradingStyle = 'HODLer';
  if (firstSeen && lastActive && txCount > 0) {
    const spanDays = (lastActive.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24);
    const txPerDay = txCount / Math.max(spanDays, 1);
    if (txPerDay > 3) tradingStyle = 'Day Trader';
    else if (txPerDay > 0.5) tradingStyle = 'Swing Trader';
    else tradingStyle = 'HODLer';
  }

  // rough total volume
  let totalVolume = 0;
  if (chain === 'EVM') {
    for (const tx of txs) {
      totalVolume += parseFloat(tx.value || '0');
    }
  }

  return {
    txCount,
    firstSeen: firstSeen?.toISOString() || null,
    lastActive: lastActive?.toISOString() || null,
    totalVolume,
    avgHoldTime: null,
    winRate: null,
    tradingStyle,
    favoriteTokens,
    partnerWallets,
  };
}

function classifyWallet(holdings: any[], totalBalance: number, txCount: number): string {
  if (totalBalance >= 1_000_000) return 'WHALE';
  if (totalBalance >= 100_000) return 'SMART MONEY';
  if (txCount > 500) return 'DEGEN';
  if (holdings.length >= 5 && totalBalance >= 10_000) return 'BALANCED';
  return 'CONSERVATIVE';
}

async function callClaudeForAnalysis(walletAddress: string, chain: string, holdings: any[], stats: any, totalBalance: number): Promise<any> {
  const holdingsText = holdings && holdings.length > 0
    ? holdings.slice(0, 15).map((h: any) => `${h.symbol}: ${h.balance} ($${h.valueUsd || '?'})`).join(', ')
    : 'No holdings detected';

  const prompt = `You are a professional crypto intelligence analyst for the Steinz {Sargon} platform. Analyze this wallet's complete DNA and provide deep intelligence.

Wallet: ${walletAddress}
Chain: ${chain}
Total Portfolio Value: $${totalBalance}
Holdings: ${holdingsText}
Transaction Count: ${stats.txCount}
Trading Style Detected: ${stats.tradingStyle}
First Seen: ${stats.firstSeen || 'Unknown'}
Last Active: ${stats.lastActive || 'Unknown'}
Top Trading Partners: ${stats.partnerWallets?.slice(0, 3).map((p: any) => p.address).join(', ') || 'None detected'}

Analyze this wallet's DNA. Give:
1) Personality profile (what kind of trader are they? Be specific about memecoin, DeFi, or blue-chip behavior)
2) 3 strengths you see in their trading
3) 3 weaknesses or risks
4) 5 specific actionable recommendations tailored to their trading style
5) Sector breakdown estimate: % Memecoins, % DeFi, % Stablecoins, % L1/L2 tokens (should sum to 100)
6) Risk classification: DEGEN | BALANCED | CONSERVATIVE | WHALE | SMART MONEY

Be direct, specific, and constructive. Focus on memecoin patterns if relevant. Return ONLY this JSON structure:
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
  "marketOutlook": "1-2 sentence outlook based on their positioning",
  "topInsight": "One key actionable insight",
  "sectorBreakdown": {
    "memecoins": 0,
    "defi": 0,
    "stablecoins": 0,
    "layer1layer2": 0
  },
  "riskClassification": "DEGEN" | "BALANCED" | "CONSERVATIVE" | "WHALE" | "SMART MONEY",
  "metrics": {
    "diversification": 0-100,
    "timing": 0-100,
    "riskManagement": 0-100,
    "consistency": 0-100,
    "conviction": 0-100
  }
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      else throw new Error('Failed to parse AI response');
    }
    return parsed;
  } catch (err) {
    console.error('Claude AI error:', err);
    return null;
  }
}

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
    // Fetch holdings from wallet-intelligence
    let holdings: any[] = [];
    let totalBalance = 0;
    let txCount = 0;

    try {
      const wiRes = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/wallet-intelligence?address=${encodeURIComponent(address)}`, {
        signal: AbortSignal.timeout(15000),
      });
      if (wiRes.ok) {
        const wiData = await wiRes.json();
        holdings = wiData.holdings || [];
        totalBalance = parseFloat(wiData.totalBalanceUsd || '0');
        txCount = wiData.txCount || 0;
      }
    } catch (e) {
      console.error('wallet-intelligence fetch failed:', e);
    }

    // Fetch transactions for stats
    let txs: any[] = [];
    if (chain === 'EVM' && ALCHEMY_API_KEY) {
      const evmRpc = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
      txs = await fetchEvmTransactions(address, evmRpc);
    } else if (chain === 'SOL') {
      txs = await fetchSolTransactions(address);
    }

    const stats = calcTradingStats(txs, chain);
    if (txCount > 0 && stats.txCount === 0) stats.txCount = txCount;

    // Risk classification from holdings+stats
    const riskClass = classifyWallet(holdings, totalBalance, stats.txCount);

    // Call Claude for AI analysis
    const aiAnalysis = await callClaudeForAnalysis(
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
      riskClassification: aiAnalysis?.riskClassification || riskClass,
      aiAnalysis,
    });
  } catch (error: any) {
    console.error('DNA analysis error:', error);
    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
