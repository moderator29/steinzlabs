import { NextResponse } from 'next/server';

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';

// GoPlus chain ID map for EVM chains
const GOPLUS_CHAIN_ID: Record<string, string> = {
  Ethereum: '1',
  Base: '8453',
  Polygon: '137',
  Avalanche: '43114',
  BSC: '56',
  Arbitrum: '42161',
};

export interface SecurityFlag {
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  explanation: string;
}

export interface ContractSecurity {
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  isOpenSource: boolean;
  isProxy: boolean;
  isMintable: boolean;
  ownershipRenounced: boolean;
  hasBlacklist: boolean;
  holderCount: number;
  trustScore: number;
  trustLevel: 'SAFE' | 'CAUTION' | 'WARNING' | 'DANGER';
  flags: SecurityFlag[];
}

async function fetchGoPlusContractSecurity(
  contractAddress: string,
  chainName: string
): Promise<ContractSecurity | null> {
  const chainId = GOPLUS_CHAIN_ID[chainName];
  if (!chainId || !contractAddress || contractAddress === 'null') return null;

  try {
    const res = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${contractAddress.toLowerCase()}`,
      { signal: AbortSignal.timeout(6000), next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const info = data?.result?.[contractAddress.toLowerCase()];
    if (!info) return null;

    const flags: SecurityFlag[] = [];

    if (info.is_honeypot === '1') {
      flags.push({ name: 'Honeypot', severity: 'critical', explanation: 'This token cannot be sold — it is a honeypot trap.' });
    }
    if (info.is_open_source !== '1') {
      flags.push({ name: 'Unverified Source', severity: 'high', explanation: 'Contract source code is not verified on-chain.' });
    }
    if (info.is_mintable === '1') {
      flags.push({ name: 'Mintable', severity: 'high', explanation: 'Owner can mint unlimited tokens, diluting supply.' });
    }
    if (info.can_take_back_ownership === '1') {
      flags.push({ name: 'Ownership Reclaimable', severity: 'high', explanation: 'Owner can reclaim ownership even after renouncing.' });
    }
    if (info.owner_change_balance === '1') {
      flags.push({ name: 'Balance Manipulation', severity: 'critical', explanation: 'Owner can modify token balances arbitrarily.' });
    }
    if (info.hidden_owner === '1') {
      flags.push({ name: 'Hidden Owner', severity: 'high', explanation: 'Contract has a concealed owner address.' });
    }
    if (info.is_proxy === '1') {
      flags.push({ name: 'Proxy Contract', severity: 'medium', explanation: 'Contract logic can be upgraded by the owner.' });
    }
    if (info.selfdestruct === '1') {
      flags.push({ name: 'Self-Destruct', severity: 'high', explanation: 'Contract can be destroyed, wiping all balances.' });
    }
    if (info.is_blacklisted === '1') {
      flags.push({ name: 'Blacklist Function', severity: 'medium', explanation: 'Owner can blacklist wallets from trading.' });
    }
    if (info.cannot_buy === '1') {
      flags.push({ name: 'Cannot Buy', severity: 'critical', explanation: 'Token buying is disabled.' });
    }
    if (info.cannot_sell_all === '1') {
      flags.push({ name: 'Cannot Sell All', severity: 'high', explanation: 'Holders cannot sell their entire balance.' });
    }

    const buyTax = parseFloat(info.buy_tax || '0') * 100;
    const sellTax = parseFloat(info.sell_tax || '0') * 100;
    if (buyTax > 10) {
      flags.push({ name: 'High Buy Tax', severity: 'high', explanation: `Buy tax is ${buyTax.toFixed(1)}% — abnormally high.` });
    } else if (buyTax > 5) {
      flags.push({ name: 'Elevated Buy Tax', severity: 'medium', explanation: `Buy tax is ${buyTax.toFixed(1)}%.` });
    }
    if (sellTax > 10) {
      flags.push({ name: 'High Sell Tax', severity: 'high', explanation: `Sell tax is ${sellTax.toFixed(1)}% — abnormally high.` });
    } else if (sellTax > 5) {
      flags.push({ name: 'Elevated Sell Tax', severity: 'medium', explanation: `Sell tax is ${sellTax.toFixed(1)}%.` });
    }

    // Compute trust score
    let trustScore = 100;
    for (const flag of flags) {
      if (flag.severity === 'critical') trustScore -= 35;
      else if (flag.severity === 'high') trustScore -= 15;
      else if (flag.severity === 'medium') trustScore -= 8;
      else if (flag.severity === 'low') trustScore -= 3;
    }
    trustScore = Math.max(0, Math.min(100, trustScore));

    let trustLevel: ContractSecurity['trustLevel'] = 'SAFE';
    if (trustScore < 30) trustLevel = 'DANGER';
    else if (trustScore < 50) trustLevel = 'WARNING';
    else if (trustScore < 70) trustLevel = 'CAUTION';

    return {
      isHoneypot: info.is_honeypot === '1',
      buyTax,
      sellTax,
      isOpenSource: info.is_open_source === '1',
      isProxy: info.is_proxy === '1',
      isMintable: info.is_mintable === '1',
      ownershipRenounced: info.can_take_back_ownership !== '1',
      hasBlacklist: info.is_blacklisted === '1',
      holderCount: parseInt(info.holder_count || '0'),
      trustScore,
      trustLevel,
      flags,
    };
  } catch {
    return null;
  }
}

const KNOWN_TOKEN_LOGOS: Record<string, string> = {
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  WETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/tether.png',
  MATIC: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
  AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
};

const DEXSCREENER_CHAIN_MAP: Record<string, string> = {
  Ethereum: 'ethereum',
  Base: 'base',
  Polygon: 'polygon',
  Avalanche: 'avalanche',
  Solana: 'solana',
};

async function fetchTokenLogoFromDexScreener(chain: string, tokenAddress: string): Promise<string | null> {
  try {
    const dexChain = DEXSCREENER_CHAIN_MAP[chain] || chain.toLowerCase();
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/${dexChain}/${tokenAddress}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.pairs?.[0]?.info?.imageUrl || null;
  } catch {
    return null;
  }
}

async function resolveTokenLogos(
  holdings: Array<{ symbol: string; contractAddress: string | null }>,
  chain: string
): Promise<Record<string, string>> {
  const logos: Record<string, string> = {};
  const fetchPromises = holdings.map(async (h) => {
    if (KNOWN_TOKEN_LOGOS[h.symbol.toUpperCase()]) {
      logos[h.symbol] = KNOWN_TOKEN_LOGOS[h.symbol.toUpperCase()];
      if (h.contractAddress) logos[h.contractAddress] = KNOWN_TOKEN_LOGOS[h.symbol.toUpperCase()];
      return;
    }
    if (h.contractAddress) {
      const url = await fetchTokenLogoFromDexScreener(chain, h.contractAddress);
      if (url) {
        logos[h.contractAddress] = url;
        logos[h.symbol] = url;
      }
    }
  });
  await Promise.all(fetchPromises);
  return logos;
}

function buildAiAnalysisContext(
  address: string,
  chain: string,
  holdings: Array<{ symbol: string; balance: string; valueUsd: string | null }>,
  totalBalanceUsd: string,
  txCount: number
): string {
  const tokenList = holdings
    .map((h) => `${h.symbol}: ${h.balance}${h.valueUsd ? ` ($${h.valueUsd})` : ''}`)
    .join(', ');
  return `Analyze this wallet: ${address} on ${chain}. Holdings: ${tokenList}. Total value: $${totalBalanceUsd}. Transaction count: ${txCount}. Give me: risk assessment, notable patterns, is this wallet suspicious or legitimate, and what actions should the wallet owner take.`;
}

interface EvmChainConfig {
  rpcUrl: string;
  nativeSymbol: string;
  chainName: string;
  explorerUrl: string;
  priceId: string;
  fallbackPrice: number;
}

const EVM_CHAINS: Record<string, EvmChainConfig> = {
  ethereum: {
    rpcUrl: ALCHEMY_API_KEY
      ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
      : 'https://eth-mainnet.g.alchemy.com/v2/demo',
    nativeSymbol: 'ETH',
    chainName: 'Ethereum',
    explorerUrl: 'https://etherscan.io',
    priceId: 'ethereum',
    fallbackPrice: 3500,
  },
  base: {
    rpcUrl: ALCHEMY_API_KEY
      ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
      : 'https://mainnet.base.org',
    nativeSymbol: 'ETH',
    chainName: 'Base',
    explorerUrl: 'https://basescan.org',
    priceId: 'ethereum',
    fallbackPrice: 3500,
  },
  polygon: {
    rpcUrl: ALCHEMY_API_KEY
      ? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
      : 'https://polygon-rpc.com',
    nativeSymbol: 'MATIC',
    chainName: 'Polygon',
    explorerUrl: 'https://polygonscan.com',
    priceId: 'matic-network',
    fallbackPrice: 0.7,
  },
  avalanche: {
    rpcUrl: ALCHEMY_API_KEY
      ? `https://avax-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
      : 'https://api.avax.network/ext/bc/C/rpc',
    nativeSymbol: 'AVAX',
    chainName: 'Avalanche',
    explorerUrl: 'https://snowtrace.io',
    priceId: 'avalanche-2',
    fallbackPrice: 35,
  },
};

const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

function detectChain(address: string): 'EVM' | 'SOL' | 'UNKNOWN' {
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) return 'EVM';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return 'SOL';
  return 'UNKNOWN';
}

async function getEvmData(address: string, rpcUrl: string, nativeSymbol: string, chainName: string, explorerUrl: string, priceId: string, fallbackPrice: number) {
  const balanceRes = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [address, 'latest'],
    }),
  });
  const balanceData = await balanceRes.json();
  const nativeBalanceWei = parseInt(balanceData.result || '0', 16);
  const nativeBalance = nativeBalanceWei / 1e18;

  const txCountRes = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'eth_getTransactionCount',
      params: [address, 'latest'],
    }),
  });
  const txCountData = await txCountRes.json();
  const txCount = parseInt(txCountData.result || '0', 16);

  let tokenBalances: any[] = [];
  const isAlchemy = rpcUrl.includes('alchemy.com');
  if (isAlchemy) {
    try {
      const tokenRes = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'alchemy_getTokenBalances',
          params: [address],
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.result?.tokenBalances) {
        tokenBalances = tokenData.result.tokenBalances
          .filter((t: any) => t.tokenBalance && t.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000')
          .slice(0, 20);
      }
    } catch (e) {
      console.error('Token balance fetch error:', e);
    }
  }

  let tokenDetails: any[] = [];
  if (tokenBalances.length > 0 && isAlchemy) {
    const metadataPromises = tokenBalances.slice(0, 10).map(async (token: any) => {
      try {
        const metaRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 4,
            method: 'alchemy_getTokenMetadata',
            params: [token.contractAddress],
          }),
        });
        const metaData = await metaRes.json();
        const decimals = metaData.result?.decimals || 18;
        const rawBalance = BigInt(token.tokenBalance);
        const balance = Number(rawBalance) / Math.pow(10, decimals);
        return {
          contractAddress: token.contractAddress,
          symbol: metaData.result?.symbol || 'UNKNOWN',
          name: metaData.result?.name || 'Unknown Token',
          decimals,
          balance: balance,
          logo: metaData.result?.logo || null,
          logoUrl: metaData.result?.logo || null,
        };
      } catch {
        return null;
      }
    });
    const results = await Promise.all(metadataPromises);
    tokenDetails = results.filter((t) => t !== null && t.balance > 0);
  }

  let nativePrice = 0;
  try {
    const priceRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${priceId}&vs_currencies=usd`, {
      headers: { 'Accept': 'application/json' },
    });
    const priceData = await priceRes.json();
    nativePrice = priceData[priceId]?.usd || 0;
  } catch {
    nativePrice = fallbackPrice;
  }

  const nativeValueUsd = nativeBalance * nativePrice;

  const holdings = [
    {
      symbol: nativeSymbol,
      name: chainName,
      balance: nativeBalance.toFixed(4),
      valueUsd: nativeValueUsd.toFixed(2),
      contractAddress: null,
      logoUrl: KNOWN_TOKEN_LOGOS[nativeSymbol] || null,
    },
    ...tokenDetails.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      balance: t.balance > 1000 ? t.balance.toFixed(0) : t.balance.toFixed(4),
      valueUsd: null,
      contractAddress: t.contractAddress,
      logoUrl: t.logoUrl || KNOWN_TOKEN_LOGOS[t.symbol.toUpperCase()] || null,
    })),
  ];

  // Resolve logos from DexScreener for tokens without logos
  const tokenLogos = await resolveTokenLogos(holdings, chainName);
  holdings.forEach((h) => {
    if (!h.logoUrl) {
      h.logoUrl = tokenLogos[h.contractAddress || h.symbol] || null;
    }
  });

  const aiAnalysisContext = buildAiAnalysisContext(address, chainName, holdings, nativeValueUsd.toFixed(2), txCount);

  return {
    chain: chainName,
    address,
    nativeBalance: nativeBalance.toFixed(4),
    nativeValueUsd: nativeValueUsd.toFixed(2),
    totalBalanceUsd: nativeValueUsd.toFixed(2),
    txCount,
    holdings,
    tokenCount: tokenDetails.length,
    explorerUrl,
    ethBalance: nativeSymbol === 'ETH' ? nativeBalance.toFixed(4) : undefined,
    ethValueUsd: nativeSymbol === 'ETH' ? nativeValueUsd.toFixed(2) : undefined,
    tokenLogos,
    aiAnalysisContext,
  };
}

async function getSolTokenPrice(mint: string): Promise<{ price: number; symbol: string; name: string } | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pair = data.pairs?.[0];
    if (!pair) return null;
    return {
      price: parseFloat(pair.priceUsd || '0'),
      symbol: pair.baseToken?.symbol || 'UNKNOWN',
      name: pair.baseToken?.name || 'Unknown Token',
    };
  } catch {
    return null;
  }
}

async function getSolData(address: string) {
  const [balanceRes, tokenRes, sigRes, priceRes] = await Promise.all([
    fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }),
    }),
    fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'getTokenAccountsByOwner',
        params: [address, { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' }, { encoding: 'jsonParsed' }],
      }),
    }),
    fetch(SOLANA_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'getSignaturesForAddress', params: [address, { limit: 1000 }] }),
    }),
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd', {
      headers: { 'Accept': 'application/json' },
    }).catch(() => null),
  ]);

  const balanceData = await balanceRes.json();
  const solBalance = (balanceData.result?.value || 0) / 1e9;

  const tokenData = await tokenRes.json();
  const tokenAccounts = tokenData.result?.value || [];

  let txCount = 0;
  try {
    const sigData = await sigRes.json();
    txCount = sigData.result?.length || 0;
  } catch { txCount = 0; }

  let solPrice = 170;
  try {
    if (priceRes) {
      const priceData = await priceRes.json();
      solPrice = priceData.solana?.usd || 170;
    }
  } catch { solPrice = 170; }

  const solValueUsd = solBalance * solPrice;

  const splTokens: Array<{ mint: string; balance: number; decimals: number }> = [];
  for (const account of tokenAccounts) {
    const info = account.account?.data?.parsed?.info;
    if (!info) continue;
    const uiAmount = info.tokenAmount?.uiAmount || 0;
    if (uiAmount <= 0) continue;
    splTokens.push({
      mint: info.mint,
      balance: uiAmount,
      decimals: info.tokenAmount?.decimals || 0,
    });
  }

  const tokenPricePromises = splTokens.slice(0, 20).map(async (token) => {
    const priceInfo = await getSolTokenPrice(token.mint);
    return { ...token, priceInfo };
  });
  const tokensWithPrices = await Promise.all(tokenPricePromises);

  let totalTokenValueUsd = 0;
  const tokenHoldings = tokensWithPrices
    .map((t) => {
      const valueUsd = t.priceInfo ? t.balance * t.priceInfo.price : 0;
      totalTokenValueUsd += valueUsd;
      const symbol = t.priceInfo?.symbol || t.mint.slice(0, 6);
      return {
        symbol,
        name: t.priceInfo?.name || `SPL Token`,
        balance: t.balance > 1000 ? t.balance.toFixed(0) : t.balance.toFixed(4),
        valueUsd: valueUsd > 0 ? valueUsd.toFixed(2) : null,
        contractAddress: t.mint,
        logoUrl: KNOWN_TOKEN_LOGOS[symbol.toUpperCase()] || null,
      };
    })
    .sort((a, b) => parseFloat(b.valueUsd || '0') - parseFloat(a.valueUsd || '0'));

  const totalBalanceUsd = solValueUsd + totalTokenValueUsd;

  const allHoldings = [
    {
      symbol: 'SOL',
      name: 'Solana',
      balance: solBalance.toFixed(4),
      valueUsd: solValueUsd.toFixed(2),
      contractAddress: null,
      logoUrl: KNOWN_TOKEN_LOGOS['SOL'],
    },
    ...tokenHoldings,
  ];

  // Fetch DexScreener logos for tokens that don't have one yet
  const tokenLogos = await resolveTokenLogos(allHoldings, 'Solana');
  allHoldings.forEach((h) => {
    if (!h.logoUrl) {
      h.logoUrl = tokenLogos[h.contractAddress || h.symbol] || null;
    }
  });

  const aiAnalysisContext = buildAiAnalysisContext(address, 'Solana', allHoldings, totalBalanceUsd.toFixed(2), txCount);

  return {
    chain: 'Solana',
    address,
    solBalance: solBalance.toFixed(4),
    solValueUsd: solValueUsd.toFixed(2),
    totalBalanceUsd: totalBalanceUsd.toFixed(2),
    txCount,
    holdings: allHoldings,
    tokenCount: tokenHoldings.length,
    explorerUrl: 'https://solscan.io',
    tokenLogos,
    aiAnalysisContext,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const chainParam = searchParams.get('chain') || 'auto';

    if (!address) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    const detectedType = detectChain(address);

    if (detectedType === 'UNKNOWN') {
      return NextResponse.json({ error: 'Invalid wallet address. Supports EVM (0x...) and SOL (base58) addresses.' }, { status: 400 });
    }

    let walletData: any;
    let chainName = 'Ethereum';

    if (detectedType === 'SOL') {
      walletData = await getSolData(address);
      chainName = 'Solana';
    } else {
      const evmChainKey = chainParam !== 'auto' && EVM_CHAINS[chainParam] ? chainParam : 'ethereum';
      const config = EVM_CHAINS[evmChainKey];
      chainName = config.chainName;
      walletData = await getEvmData(
        address,
        config.rpcUrl,
        config.nativeSymbol,
        config.chainName,
        config.explorerUrl,
        config.priceId,
        config.fallbackPrice
      );
    }

    // GoPlus security scan for top EVM token holdings (non-native, non-SOL)
    let contractSecurityMap: Record<string, ContractSecurity | null> = {};
    if (detectedType === 'EVM' && walletData.holdings) {
      const evmTokens: Array<{ contractAddress: string }> = (walletData.holdings as Array<{ contractAddress: string | null }>)
        .filter((h) => h.contractAddress && h.contractAddress !== 'null')
        .slice(0, 5) as Array<{ contractAddress: string }>;

      if (evmTokens.length > 0) {
        const securityResults = await Promise.allSettled(
          evmTokens.map((h) => fetchGoPlusContractSecurity(h.contractAddress, chainName))
        );
        evmTokens.forEach((h, i) => {
          const result = securityResults[i];
          contractSecurityMap[h.contractAddress] = result.status === 'fulfilled' ? result.value : null;
        });
      }
    }

    return NextResponse.json({ ...walletData, contractSecurity: contractSecurityMap }, {
      headers: {
        'Cache-Control': 'public, max-age=30',
      },
    });
  } catch (error: any) {
    console.error('Wallet intelligence error:', error);
    return NextResponse.json({ error: error.message || 'Failed to analyze wallet' }, { status: 500 });
  }
}
