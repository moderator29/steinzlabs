import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: parseInt(process.env.API_TIMEOUT_MS || '600000') })
  : null;

const CHAIN_MAP: Record<string, string> = {
  ethereum: '1',
  eth: '1',
  bsc: '56',
  polygon: '137',
  solana: 'solana',
  sol: 'solana',
  base: '8453',
  avalanche: '43114',
  avax: '43114',
  arbitrum: '42161',
  arb: '42161',
  '1': '1',
  '56': '56',
  '137': '137',
  '8453': '8453',
  '43114': '43114',
  '42161': '42161',
};

function isSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

async function fetchGoPlusSecurity(chainId: string, contractAddress: string) {
  const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${contractAddress}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`GoPlus API error: ${res.status}`);
  const data = await res.json();
  return data;
}

async function fetchDexScreenerData(contractAddress: string) {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`DexScreener API error: ${res.status}`);
  const data = await res.json();
  return data;
}

function calculateTrustScore(tokenData: any): { score: number; level: string; color: string } {
  let score = 100;
  const penalties: string[] = [];

  if (tokenData.is_honeypot === '1') { score -= 40; penalties.push('honeypot'); }
  if (tokenData.is_open_source !== '1') { score -= 15; penalties.push('not open source'); }
  if (tokenData.is_proxy === '1') { score -= 10; penalties.push('proxy contract'); }
  if (tokenData.is_mintable === '1') { score -= 10; penalties.push('mintable'); }
  if (tokenData.can_take_back_ownership === '1') { score -= 15; penalties.push('can reclaim ownership'); }
  if (tokenData.owner_change_balance === '1') { score -= 15; penalties.push('owner can change balance'); }
  if (tokenData.hidden_owner === '1') { score -= 10; penalties.push('hidden owner'); }
  if (tokenData.selfdestruct === '1') { score -= 10; penalties.push('self-destruct'); }
  if (tokenData.external_call === '1') { score -= 5; penalties.push('external calls'); }
  if (tokenData.cannot_buy === '1') { score -= 20; penalties.push('cannot buy'); }
  if (tokenData.cannot_sell_all === '1') { score -= 15; penalties.push('cannot sell all'); }
  if (tokenData.trading_cooldown === '1') { score -= 5; penalties.push('trading cooldown'); }
  if (tokenData.is_anti_whale === '1') { score -= 3; }

  const buyTax = parseFloat(tokenData.buy_tax || '0');
  const sellTax = parseFloat(tokenData.sell_tax || '0');
  if (buyTax > 0.1) { score -= 10; penalties.push('high buy tax'); }
  else if (buyTax > 0.05) { score -= 5; }
  if (sellTax > 0.1) { score -= 10; penalties.push('high sell tax'); }
  else if (sellTax > 0.05) { score -= 5; }

  score = Math.max(0, Math.min(100, score));

  let level = 'SAFE';
  let color = '#10B981';
  if (score < 30) { level = 'DANGER'; color = '#EF4444'; }
  else if (score < 50) { level = 'WARNING'; color = '#F59E0B'; }
  else if (score < 70) { level = 'CAUTION'; color = '#F59E0B'; }

  return { score, level, color };
}

function buildChecks(tokenData: any) {
  return [
    {
      label: 'Contract Verified (Open Source)',
      status: tokenData.is_open_source === '1' ? 'pass' : 'fail',
    },
    {
      label: 'No Honeypot',
      status: tokenData.is_honeypot === '1' ? 'fail' : 'pass',
    },
    {
      label: 'Ownership Renounced',
      status: tokenData.owner_address === '' || tokenData.owner_address === '0x0000000000000000000000000000000000000000' ? 'pass' : tokenData.can_take_back_ownership === '1' ? 'fail' : 'warn',
    },
    {
      label: 'No Mint Function',
      status: tokenData.is_mintable === '1' ? 'fail' : 'pass',
    },
    {
      label: 'No Proxy Contract',
      status: tokenData.is_proxy === '1' ? 'warn' : 'pass',
    },
    {
      label: 'No Hidden Owner',
      status: tokenData.hidden_owner === '1' ? 'fail' : 'pass',
    },
    {
      label: 'No Self-Destruct',
      status: tokenData.selfdestruct === '1' ? 'fail' : 'pass',
    },
    {
      label: 'Can Sell All Tokens',
      status: tokenData.cannot_sell_all === '1' ? 'fail' : 'pass',
    },
    {
      label: 'Buy Tax Acceptable (< 10%)',
      status: parseFloat(tokenData.buy_tax || '0') > 0.1 ? 'fail' : parseFloat(tokenData.buy_tax || '0') > 0.05 ? 'warn' : 'pass',
    },
    {
      label: 'Sell Tax Acceptable (< 10%)',
      status: parseFloat(tokenData.sell_tax || '0') > 0.1 ? 'fail' : parseFloat(tokenData.sell_tax || '0') > 0.05 ? 'warn' : 'pass',
    },
  ];
}

function buildResponse(contractAddress: string, chainId: string, tokenData: any): any {
  const { score, level, color } = calculateTrustScore(tokenData);
  const checks = buildChecks(tokenData);

  const buyTax = parseFloat(tokenData.buy_tax || '0');
  const sellTax = parseFloat(tokenData.sell_tax || '0');

  return {
    contract: contractAddress,
    chainId,
    name: tokenData.token_name || 'Unknown Token',
    symbol: tokenData.token_symbol || '???',
    totalSupply: tokenData.total_supply || 'N/A',
    holderCount: parseInt(tokenData.holder_count || '0'),
    creatorAddress: tokenData.creator_address || 'N/A',
    ownerAddress: tokenData.owner_address || 'N/A',
    trustScore: score,
    safetyLevel: level,
    safetyColor: color,
    buyTax: (buyTax * 100).toFixed(1) + '%',
    sellTax: (sellTax * 100).toFixed(1) + '%',
    isHoneypot: tokenData.is_honeypot === '1',
    isOpenSource: tokenData.is_open_source === '1',
    isMintable: tokenData.is_mintable === '1',
    isProxy: tokenData.is_proxy === '1',
    hasHiddenOwner: tokenData.hidden_owner === '1',
    canTakeBackOwnership: tokenData.can_take_back_ownership === '1',
    ownerCanChangeBalance: tokenData.owner_change_balance === '1',
    lpHolders: tokenData.lp_holders || [],
    lpTotalSupply: tokenData.lp_total_supply || 'N/A',
    checks,
    timestamp: new Date().toISOString(),
  };
}

function buildSolanaResponse(contractAddress: string, dexData: any) {
  const pairs = dexData.pairs || [];
  const top = pairs[0];

  if (!top) {
    return null;
  }

  const volume24h = top.volume?.h24 || 0;
  const liquidity = top.liquidity?.usd || 0;
  const txns24h = top.txns?.h24 || { buys: 0, sells: 0 };
  const totalTxns = (txns24h.buys || 0) + (txns24h.sells || 0);

  let score = 70;
  if (liquidity > 100000) score += 10;
  else if (liquidity < 10000) score -= 15;
  if (volume24h > 50000) score += 5;
  if (totalTxns > 100) score += 5;
  else if (totalTxns < 10) score -= 10;
  if (top.info?.websites?.length > 0) score += 5;
  if (top.info?.socials?.length > 0) score += 5;
  score = Math.max(0, Math.min(100, score));

  let level = 'SAFE';
  let color = '#10B981';
  if (score < 30) { level = 'DANGER'; color = '#EF4444'; }
  else if (score < 50) { level = 'WARNING'; color = '#F59E0B'; }
  else if (score < 70) { level = 'CAUTION'; color = '#F59E0B'; }

  const checks = [
    { label: 'Token Listed on DEX', status: 'pass' as const },
    { label: 'Has Liquidity Pool', status: liquidity > 1000 ? 'pass' as const : 'fail' as const },
    { label: 'Active Trading Volume', status: volume24h > 1000 ? 'pass' as const : volume24h > 0 ? 'warn' as const : 'fail' as const },
    { label: 'Multiple Transactions', status: totalTxns > 50 ? 'pass' as const : totalTxns > 5 ? 'warn' as const : 'fail' as const },
    { label: 'Has Website', status: top.info?.websites?.length > 0 ? 'pass' as const : 'warn' as const },
    { label: 'Has Social Links', status: top.info?.socials?.length > 0 ? 'pass' as const : 'warn' as const },
    { label: 'Healthy Buy/Sell Ratio', status: txns24h.buys > 0 && txns24h.sells > 0 ? 'pass' as const : 'warn' as const },
    { label: 'Sufficient Liquidity (>$10k)', status: liquidity > 10000 ? 'pass' as const : liquidity > 1000 ? 'warn' as const : 'fail' as const },
  ];

  return {
    contract: contractAddress,
    chainId: 'solana',
    name: top.baseToken?.name || 'Unknown Token',
    symbol: top.baseToken?.symbol || '???',
    totalSupply: 'N/A',
    holderCount: 0,
    creatorAddress: 'N/A',
    ownerAddress: 'N/A',
    trustScore: score,
    safetyLevel: level,
    safetyColor: color,
    buyTax: '0.0%',
    sellTax: '0.0%',
    isHoneypot: false,
    isOpenSource: true,
    isMintable: false,
    isProxy: false,
    hasHiddenOwner: false,
    canTakeBackOwnership: false,
    ownerCanChangeBalance: false,
    lpHolders: [],
    lpTotalSupply: 'N/A',
    checks,
    timestamp: new Date().toISOString(),
    dexData: {
      price: parseFloat(top.priceUsd || '0'),
      priceChange24h: top.priceChange?.h24 || 0,
      volume24h,
      liquidity,
      fdv: top.fdv || 0,
      marketCap: top.marketCap || top.fdv || 0,
      dexId: top.dexId,
      pairAddress: top.pairAddress,
      url: top.url,
      image: top.info?.imageUrl || null,
      socials: top.info?.socials || [],
      websites: top.info?.websites || [],
    },
    solanaNote: 'Security data sourced from DexScreener market analysis. GoPlus contract audit not available for Solana. Always DYOR.',
  };
}

async function handleSolanaToken(contractAddress: string) {
  const dexData = await fetchDexScreenerData(contractAddress);
  const response = buildSolanaResponse(contractAddress, dexData);
  if (!response) {
    throw new Error('Token not found on DexScreener. Verify the Solana token address.');
  }
  return response;
}

const EVM_RPC_URLS: Record<string, string> = {
  '1': 'https://eth.llamarpc.com',
  '56': 'https://bsc-dataseed.binance.org',
  '137': 'https://polygon-rpc.com',
  '8453': 'https://mainnet.base.org',
  '43114': 'https://api.avax.network/ext/bc/C/rpc',
  '42161': 'https://arb1.arbitrum.io/rpc',
};

async function isEOAWallet(address: string, chainId: string): Promise<boolean> {
  const rpcUrl = EVM_RPC_URLS[chainId];
  if (!rpcUrl) return false;
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getCode',
        params: [address, 'latest'],
      }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const code = data.result;
    return !code || code === '0x' || code === '0x0';
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const { contract, chain = 'ethereum' } = await request.json();

    if (!contract) {
      return NextResponse.json({ error: 'Contract address required' }, { status: 400 });
    }

    const chainId = CHAIN_MAP[chain.toLowerCase()] || '1';
    const isSolana = chainId === 'solana' || isSolanaAddress(contract.trim());

    if (isSolana) {
      const response = await handleSolanaToken(contract.trim());
      return NextResponse.json(response, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      });
    }

    const contractAddress = contract.toLowerCase().trim();

    if (/^0x[a-fA-F0-9]{40}$/i.test(contractAddress)) {
      const isWallet = await isEOAWallet(contractAddress, chainId);
      if (isWallet) {
        return NextResponse.json({
          error: 'This is a Wallet Address, Not a Contract',
          isWalletAddress: true,
          message: 'The address you entered belongs to an externally owned account (wallet), not a smart contract. Token Scanner only analyzes contract addresses.',
          suggestion: 'Use the DNA Analyzer to analyze wallet addresses.',
          redirectUrl: '/dashboard/dna-analyzer',
        }, { status: 400 });
      }
    }

    const data = await fetchGoPlusSecurity(chainId, contractAddress);

    if (!data.result || !data.result[contractAddress]) {
      if (/^0x[a-fA-F0-9]{40}$/i.test(contractAddress)) {
        const isWallet = await isEOAWallet(contractAddress, chainId);
        if (isWallet) {
          return NextResponse.json({
            error: 'This is a Wallet Address, Not a Contract',
            isWalletAddress: true,
            message: 'The address you entered belongs to an externally owned account (wallet), not a smart contract. Token Scanner only analyzes contract addresses.',
            suggestion: 'Use the DNA Analyzer to analyze wallet addresses.',
            redirectUrl: '/dashboard/dna-analyzer',
          }, { status: 400 });
        }
      }
      return NextResponse.json({ error: 'Token not found. Verify the contract address and chain.' }, { status: 404 });
    }

    const tokenData = data.result[contractAddress];
    const response = buildResponse(contractAddress, chainId, tokenData);

    try {
      const dexData = await fetchDexScreenerData(contractAddress);
      const topPair = dexData.pairs?.[0];
      if (topPair) {
        response.dexData = {
          price: parseFloat(topPair.priceUsd || '0'),
          priceChange24h: topPair.priceChange?.h24 || 0,
          volume24h: topPair.volume?.h24 || 0,
          liquidity: topPair.liquidity?.usd || 0,
          fdv: topPair.fdv || 0,
          marketCap: topPair.marketCap || topPair.fdv || 0,
          dexId: topPair.dexId,
          pairAddress: topPair.pairAddress,
          url: topPair.url,
          image: topPair.info?.imageUrl || null,
          socials: topPair.info?.socials || [],
          websites: topPair.info?.websites || [],
        };
      }
    } catch {}

    // AI Security Analysis — runs in parallel-safe fashion
    if (anthropic) {
      try {
        const chainLabel = chainId === '1' ? 'Ethereum' : chainId === '56' ? 'BSC' : chainId === '137' ? 'Polygon' : chainId === '8453' ? 'Base' : chainId === '42161' ? 'Arbitrum' : 'EVM';
        const flags = response.checks.filter((c: any) => c.status === 'fail').map((c: any) => c.label).join(', ') || 'None';
        const aiMsg = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `You are a crypto security expert. Analyze this token security scan and give a concise verdict.

Token: ${response.name} (${response.symbol}) on ${chainLabel}
Trust Score: ${response.trustScore}/100 — ${response.safetyLevel}
Honeypot: ${response.isHoneypot ? 'YES ⚠️' : 'No'}
Open Source: ${response.isOpenSource ? 'Yes' : 'NO ⚠️'}
Mintable: ${response.isMintable ? 'YES ⚠️' : 'No'}
Hidden Owner: ${response.hasHiddenOwner ? 'YES ⚠️' : 'No'}
Owner Can Change Balance: ${response.ownerCanChangeBalance ? 'YES ⚠️' : 'No'}
Buy Tax: ${response.buyTax} | Sell Tax: ${response.sellTax}
Holders: ${response.holderCount}
Failed Checks: ${flags}

Respond with 3 sections only:
SUMMARY: (2 sentences max — plain risk assessment)
RISKS: (bullet list of top risks, or "No critical risks identified" if clean)
VERDICT: (one word: SAFE / CAUTION / WARNING / DANGER) — (one sentence why)`,
          }],
        });
        const aiText = aiMsg.content[0].type === 'text' ? aiMsg.content[0].text : null;
        if (aiText) response.aiAnalysis = aiText;
      } catch { /* AI analysis non-critical */ }
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error: any) {

    return NextResponse.json({ error: error.message || 'Failed to scan token' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const contract = searchParams.get('contract');
    const chain = searchParams.get('chain') || 'ethereum';

    if (!contract) {
      return NextResponse.json({ error: 'Contract address required (use ?contract=0x...)' }, { status: 400 });
    }

    const chainId = CHAIN_MAP[chain.toLowerCase()] || '1';
    const isSolana = chainId === 'solana' || isSolanaAddress(contract.trim());

    if (isSolana) {
      const response = await handleSolanaToken(contract.trim());
      return NextResponse.json(response, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
      });
    }

    const contractAddress = contract.toLowerCase().trim();
    const data = await fetchGoPlusSecurity(chainId, contractAddress);

    if (!data.result || !data.result[contractAddress]) {
      return NextResponse.json({ error: 'Token not found. Verify the contract address and chain.' }, { status: 404 });
    }

    const tokenData = data.result[contractAddress];
    const response = buildResponse(contractAddress, chainId, tokenData);

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error: any) {

    return NextResponse.json({ error: error.message || 'Failed to scan token' }, { status: 500 });
  }
}
