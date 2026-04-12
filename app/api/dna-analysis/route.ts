import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const _anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.CLAUDE_KEY || process.env.ANTHROPIC_KEY;
const anthropic = _anthropicKey ? new Anthropic({ apiKey: _anthropicKey }) : null;
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY_1 || process.env.HELIUS_API_KEY_2 || '';

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

async function callAIForAnalysis(walletAddress: string, chain: string, holdings: any[], stats: any, totalBalance: number): Promise<any> {
  const holdingsText = holdings && holdings.length > 0
    ? holdings.slice(0, 30).map((h: any) => `${h.symbol}: ${h.balance} ($${h.valueUsd || '?'})`).join(', ')
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
    const client = anthropic;
    if (!client) {

      return null;
    }
    const MODELS = ['claude-sonnet-4-6', 'claude-3-5-sonnet-20241022'];
    let message: Awaited<ReturnType<typeof client.messages.create>> | null = null;
    for (const model of MODELS) {
      try {
        message = await client.messages.create({
          model,
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        });
        break;
      } catch (err: any) {
        // model failed, try next
      }
    }
    if (!message) return null;

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

    return null;
  }
}

// ─── Inline wallet data fetchers (avoids self-referential HTTP calls) ─────────

async function fetchSolWalletData(address: string): Promise<{ holdings: any[]; totalBalanceUsd: string; txCount: number }> {
  try {
    const [balanceRes, tokenRes, sigRes, solPriceRes] = await Promise.all([
      fetch(SOLANA_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }),
        signal: AbortSignal.timeout(10000),
      }),
      fetch(SOLANA_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 2, method: 'getTokenAccountsByOwner',
          params: [address, { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }],
        }),
        signal: AbortSignal.timeout(10000),
      }),
      fetch(SOLANA_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'getSignaturesForAddress', params: [address, { limit: 50 }] }),
        signal: AbortSignal.timeout(10000),
      }),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      }).catch(() => null),
    ]);

    const balanceData = await balanceRes.json();
    const solBalance = (balanceData.result?.value || 0) / 1e9;

    const tokenData = await tokenRes.json();
    const tokenAccounts = tokenData.result?.value || [];

    let txCount = 0;
    try { const sigData = await sigRes.json(); txCount = sigData.result?.length || 0; } catch {}

    let solPrice = 170;
    try {
      if (solPriceRes) { const pd = await solPriceRes.json(); solPrice = pd.solana?.usd || 170; }
    } catch {}

    const solValueUsd = solBalance * solPrice;

    // Get SPL token prices
    const splTokens: Array<{ mint: string; balance: number }> = [];
    for (const account of tokenAccounts) {
      const info = account.account?.data?.parsed?.info;
      if (!info) continue;
      const uiAmount = info.tokenAmount?.uiAmount || 0;
      if (uiAmount <= 0) continue;
      splTokens.push({ mint: info.mint, balance: uiAmount });
    }

    const tokenPricePromises = splTokens.slice(0, 50).map(async (token) => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.mint}`, { signal: AbortSignal.timeout(4000) });
        if (!res.ok) return { ...token, symbol: token.mint.slice(0, 6), name: 'SPL Token', priceUsd: 0 };
        const data = await res.json();
        const pair = data.pairs?.[0];
        return {
          ...token,
          symbol: pair?.baseToken?.symbol || token.mint.slice(0, 6),
          name: pair?.baseToken?.name || 'SPL Token',
          priceUsd: parseFloat(pair?.priceUsd || '0'),
        };
      } catch {
        return { ...token, symbol: token.mint.slice(0, 6), name: 'SPL Token', priceUsd: 0 };
      }
    });
    const tokensWithPrices = await Promise.all(tokenPricePromises);

    let totalTokenValue = 0;
    const tokenHoldings = tokensWithPrices.map((t) => {
      const valueUsd = t.balance * t.priceUsd;
      totalTokenValue += valueUsd;
      return {
        symbol: t.symbol,
        name: t.name,
        balance: t.balance > 1000 ? t.balance.toFixed(0) : t.balance.toFixed(4),
        valueUsd: valueUsd > 0 ? valueUsd.toFixed(2) : null,
        contractAddress: t.mint,
      };
    }).sort((a, b) => parseFloat(b.valueUsd || '0') - parseFloat(a.valueUsd || '0'));

    return {
      holdings: [
        { symbol: 'SOL', name: 'Solana', balance: solBalance.toFixed(4), valueUsd: solValueUsd.toFixed(2), contractAddress: null },
        ...tokenHoldings,
      ],
      totalBalanceUsd: (solValueUsd + totalTokenValue).toFixed(2),
      txCount,
    };
  } catch (e) {

    return { holdings: [], totalBalanceUsd: '0', txCount: 0 };
  }
}

async function fetchEvmWalletData(address: string): Promise<{ holdings: any[]; totalBalanceUsd: string; txCount: number }> {
  try {
    const rpcUrl = ALCHEMY_API_KEY
      ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
      : 'https://eth.llamarpc.com';

    const [balRes, txCountRes] = await Promise.all([
      fetch(rpcUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }),
        signal: AbortSignal.timeout(8000),
      }),
      fetch(rpcUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_getTransactionCount', params: [address, 'latest'] }),
        signal: AbortSignal.timeout(8000),
      }),
    ]);

    const balData = await balRes.json();
    const ethBalance = parseInt(balData.result || '0', 16) / 1e18;
    const txCountData = await txCountRes.json();
    const txCount = parseInt(txCountData.result || '0', 16);

    // Get ETH price
    let ethPrice = 3500;
    try {
      const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', { signal: AbortSignal.timeout(5000) });
      if (priceRes.ok) { const pd = await priceRes.json(); ethPrice = pd.ethereum?.usd || 3500; }
    } catch {}

    const ethValueUsd = ethBalance * ethPrice;

    // Get ERC-20 token balances via Alchemy if available
    let tokenHoldings: any[] = [];
    if (ALCHEMY_API_KEY) {
      try {
        const tokenRes = await fetch(rpcUrl, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'alchemy_getTokenBalances', params: [address] }),
          signal: AbortSignal.timeout(10000),
        });
        const tokenData = await tokenRes.json();
        const rawBalances = (tokenData.result?.tokenBalances || [])
          .filter((t: any) => t.tokenBalance && t.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000')
          .slice(0, 50);

        const metaPromises = rawBalances.map(async (token: any) => {
          try {
            const metaRes = await fetch(rpcUrl, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'alchemy_getTokenMetadata', params: [token.contractAddress] }),
              signal: AbortSignal.timeout(5000),
            });
            const metaData = await metaRes.json();
            const decimals = metaData.result?.decimals || 18;
            const balance = Number(BigInt(token.tokenBalance)) / Math.pow(10, decimals);
            if (balance <= 0) return null;
            return {
              symbol: metaData.result?.symbol || 'UNKNOWN',
              name: metaData.result?.name || 'Unknown Token',
              balance: balance > 1000 ? balance.toFixed(0) : balance.toFixed(4),
              valueUsd: null,
              contractAddress: token.contractAddress,
            };
          } catch { return null; }
        });
        const results = await Promise.all(metaPromises);
        tokenHoldings = results.filter(Boolean);
      } catch (e) {

      }
    }

    return {
      holdings: [
        { symbol: 'ETH', name: 'Ethereum', balance: ethBalance.toFixed(4), valueUsd: ethValueUsd.toFixed(2), contractAddress: null },
        ...tokenHoldings,
      ],
      totalBalanceUsd: ethValueUsd.toFixed(2),
      txCount,
    };
  } catch (e) {

    return { holdings: [], totalBalanceUsd: '0', txCount: 0 };
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
    // Fetch holdings directly (no self-referential HTTP call)
    let holdings: any[] = [];
    let totalBalance = 0;
    let txCount = 0;

    try {
      if (chain === 'SOL') {
        const walletData = await fetchSolWalletData(address);
        holdings = walletData.holdings;
        totalBalance = parseFloat(walletData.totalBalanceUsd || '0');
        txCount = walletData.txCount || 0;
      } else {
        const walletData = await fetchEvmWalletData(address);
        holdings = walletData.holdings;
        totalBalance = parseFloat(walletData.totalBalanceUsd || '0');
        txCount = walletData.txCount || 0;
      }
    } catch (e) {

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

    // Call AI for analysis
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
      riskClassification: aiAnalysis?.riskClassification || riskClass,
      aiAnalysis,
      recentTransactions: txs.slice(0, 25).map((tx: any) => ({
        hash: tx.hash || tx.signature || '',
        type: tx.category || (tx.err ? 'failed' : 'transfer'),
        asset: tx.asset || tx.tokenSymbol || 'SOL',
        amount: tx.value ? parseFloat(tx.value).toFixed(4) : '—',
        from: tx.from || address,
        to: tx.to || '',
        blockTime: tx.metadata?.blockTimestamp || (tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null),
      })),
    });
  } catch (error: any) {

    return NextResponse.json({ error: error.message || 'Analysis failed' }, { status: 500 });
  }
}
