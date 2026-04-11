import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { arkhamAPI } from '@/lib/arkham/api';

// Health check — used by admin dashboard to verify VTX is online
export async function GET() {
  const configured = !!(
    process.env.ANTHROPIC_API_KEY
    || process.env.CLAUDE_API_KEY
    || process.env.CLAUDE_KEY
    || process.env.ANTHROPIC_KEY
  );
  return NextResponse.json(
    { status: configured ? 'online' : 'unconfigured', engine: 'VTX Intelligence', version: '2.0' },
    { status: configured ? 200 : 503 }
  );
}

const FREE_TIER_LIMIT = 25;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getRateLimitInfo(ip: string): { remaining: number; total: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    const resetAt = now + 24 * 60 * 60 * 1000;
    rateLimitStore.set(ip, { count: 0, resetAt });
    return { remaining: FREE_TIER_LIMIT, total: FREE_TIER_LIMIT, resetAt };
  }
  return { remaining: Math.max(0, FREE_TIER_LIMIT - entry.count), total: FREE_TIER_LIMIT, resetAt: entry.resetAt };
}

function incrementUsage(ip: string): void {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
  } else {
    entry.count += 1;
  }
}

async function fetchWebSearch(query: string): Promise<string> {
  try {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' crypto')}&format=json&no_html=1&skip_disambig=1`);
    if (!res.ok) return '';
    const data = await res.json();
    const results: string[] = [];
    if (data.AbstractText) results.push(`Summary: ${data.AbstractText}`);
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text) results.push(`- ${topic.Text}`);
      }
    }
    return results.length > 0 ? `Web Search Results for "${query}":\n${results.join('\n')}` : '';
  } catch {
    return '';
  }
}

async function fetchLiveMarketData(): Promise<string> {
  // Primary: Binance (no API key, highly reliable, real-time)
  try {
    const BINANCE_SYMBOLS = [
      'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT',
      'AVAXUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','LINKUSDT','UNIUSDT',
      'ATOMUSDT','LTCUSDT','NEARUSDT','APTUSDT','ARBUSDT','OPUSDT',
      'INJUSDT','SUIUSDT','TONUSDT','PEPEUSDT','WIFUSDT','BONKUSDT',
    ];
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(BINANCE_SYMBOLS))}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const lines = data.map((t: any) => {
          const sym = t.symbol.replace('USDT', '');
          const price = parseFloat(t.lastPrice);
          const change24h = parseFloat(t.priceChangePercent);
          const vol = parseFloat(t.quoteVolume);
          const priceStr = price >= 1000
            ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : price >= 1
              ? `$${price.toFixed(4)}`
              : `$${price.toFixed(8)}`;
          return `${sym}: ${priceStr} (24h: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%, Vol: $${(vol / 1e6).toFixed(0)}M)`;
        });
        return 'LIVE MARKET PRICES (real-time):\n' + lines.join('\n');
      }
    }
  } catch {}

  // Fallback: CoinGecko
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h,7d',
      {
        headers: process.env.COINGECKO_API_KEY
          ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
          : {},
        cache: 'no-store',
      }
    );
    if (!res.ok) return '';
    const coins = await res.json();
    const lines = coins.map((c: any) =>
      `${c.symbol.toUpperCase()}: $${c.current_price?.toLocaleString()} (24h: ${c.price_change_percentage_24h?.toFixed(2)}%, MCap: $${(c.market_cap / 1e9).toFixed(1)}B, Vol: $${(c.total_volume / 1e6).toFixed(0)}M)`
    );
    return 'LIVE MARKET PRICES:\n' + lines.join('\n');
  } catch {
    return '';
  }
}

async function fetchDexScreenerTokenPrice(query: string): Promise<string> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return '';
    const data = await res.json();
    const pairs = data.pairs?.slice(0, 3);
    if (!pairs?.length) return '';
    const lines = pairs.map((p: any) => {
      const priceUsd = p.priceUsd ? (parseFloat(p.priceUsd) < 0.001 ? `$${parseFloat(p.priceUsd).toFixed(8)}` : `$${parseFloat(p.priceUsd).toFixed(6)}`) : 'N/A';
      const change24h = p.priceChange?.h24 != null ? `${p.priceChange.h24 >= 0 ? '+' : ''}${p.priceChange.h24.toFixed(2)}%` : 'N/A';
      const fdv = p.fdv ? `$${(p.fdv / 1e6).toFixed(2)}M` : 'N/A';
      const vol24h = p.volume?.h24 ? `$${(p.volume.h24 / 1e3).toFixed(0)}K` : 'N/A';
      const liq = p.liquidity?.usd ? `$${(p.liquidity.usd / 1e3).toFixed(0)}K` : 'N/A';
      return `${p.baseToken.name} (${p.baseToken.symbol}) on ${p.chainId}:\nPrice: ${priceUsd} | 24h: ${change24h} | FDV: ${fdv} | Vol: ${vol24h} | Liquidity: ${liq}\nContract: ${p.baseToken.address} | DEX: ${p.dexId}`;
    });
    return `TOKEN PRICE DATA for "${query}":\n\n${lines.join('\n\n')}`;
  } catch {
    return '';
  }
}

async function fetchTrendingTokens(): Promise<string> {
  try {
    const res = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
      next: { revalidate: 60 },
    });
    if (!res.ok) return '';
    const data = await res.json();
    if (!Array.isArray(data)) return '';
    const lines = data.slice(0, 8).map((t: any) =>
      `${t.tokenAddress?.slice(0, 8)}... on ${t.chainId} — ${t.description || 'trending'} (${t.amount || 0} boosts)`
    );
    return lines.length > 0 ? 'DexScreener trending tokens:\n' + lines.join('\n') : '';
  } catch {
    return '';
  }
}

async function fetchMemecoinsContext(): Promise<string> {
  try {
    const res = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
      next: { revalidate: 60 },
    });
    if (!res.ok) return '';
    const data = await res.json();
    if (!Array.isArray(data)) return '';
    const lines = data.slice(0, 15).map((t: any) =>
      `${t.tokenAddress?.slice(0, 10)}... on ${t.chainId} — ${t.description || 'no description'} (boosts: ${t.amount || 0})`
    );
    return lines.length > 0
      ? 'Current hot DEX tokens:\n' + lines.join('\n')
      : '';
  } catch {
    return '';
  }
}

async function fetchCryptoNews(): Promise<string> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/search/trending', {
      headers: process.env.COINGECKO_API_KEY
        ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
        : {},
      next: { revalidate: 120 },
    });
    if (!res.ok) return '';
    const data = await res.json();
    const coins = data.coins?.slice(0, 7).map((c: any) =>
      `${c.item.symbol}: rank #${c.item.market_cap_rank || '?'}, price $${c.item.data?.price?.toFixed(6) || '?'}, 24h: ${c.item.data?.price_change_percentage_24h?.usd?.toFixed(1) || '?'}%`
    ) || [];
    return coins.length > 0 ? 'Trending on CoinGecko:\n' + coins.join('\n') : '';
  } catch {
    return '';
  }
}

async function fetchFearAndGreedIndex(): Promise<string> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', {
      next: { revalidate: 300 },
    });
    if (!res.ok) return '';
    const data = await res.json();
    const entry = data.data?.[0];
    if (!entry) return '';
    return `Fear & Greed Index: ${entry.value}/100 (${entry.value_classification}) — updated ${entry.time_until_update || 'recently'}`;
  } catch {
    return '';
  }
}

async function fetchGasPrice(): Promise<string> {
  try {
    const etherscanKey = process.env.ETHERSCAN_API_KEY;
    if (!etherscanKey) return '';
    const res = await fetch(
      `https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=${etherscanKey}`,
      { next: { revalidate: 30 } }
    );
    if (!res.ok) return '';
    const data = await res.json();
    if (data.status !== '1' || !data.result) return '';
    const r = data.result;
    return `Ethereum Gas Prices: Low ${r.SafeGasPrice} gwei | Standard ${r.ProposeGasPrice} gwei | Fast ${r.FastGasPrice} gwei`;
  } catch {
    return '';
  }
}

function detectWalletAddress(message: string): { address: string; chain: 'eth' | 'sol' } | null {
  const ethMatch = message.match(/0x[a-fA-F0-9]{40}/);
  if (ethMatch) return { address: ethMatch[0], chain: 'eth' };
  const solMatch = message.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (solMatch && !solMatch[0].match(/^(https?|www\.|[a-z]+\.[a-z])/i)) {
    const candidate = solMatch[0];
    if (candidate.length >= 32 && candidate.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(candidate)) {
      return { address: candidate, chain: 'sol' };
    }
  }
  return null;
}

function detectTokenAddress(message: string): string | null {
  const ethMatch = message.match(/0x[a-fA-F0-9]{40}/);
  if (ethMatch) return ethMatch[0];
  const solMatch = message.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (solMatch && !solMatch[0].match(/^(https?|www\.|[a-z]+\.[a-z])/i)) {
    const candidate = solMatch[0];
    if (candidate.length >= 32 && candidate.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function fetchWalletData(address: string, chain: 'eth' | 'sol'): Promise<string> {
  try {
    if (chain === 'eth') {
      const alchemyKey = process.env.ALCHEMY_API_KEY;
      const rpcUrl = alchemyKey
        ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
        : 'https://eth.llamarpc.com';

      const [balanceRes, txCountRes] = await Promise.all([
        fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }),
        }),
        fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_getTransactionCount', params: [address, 'latest'] }),
        }),
      ]);

      const balanceData = await balanceRes.json();
      const txData = await txCountRes.json();
      const ethBalance = parseInt(balanceData.result || '0', 16) / 1e18;
      const txCount = parseInt(txData.result || '0', 16);

      let tokenInfo = '';
      if (alchemyKey) {
        try {
          const tokenRes = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0', id: 3, method: 'alchemy_getTokenBalances',
              params: [address, 'DEFAULT_TOKENS'],
            }),
          });
          const tokenData = await tokenRes.json();
          const nonZero = tokenData.result?.tokenBalances?.filter((t: any) => t.tokenBalance !== '0x0000000000000000000000000000000000000000000000000000000000000000')?.length || 0;
          tokenInfo = `, Token types held: ${nonZero}`;
        } catch {}
      }

      return `ON-CHAIN WALLET DATA for ${address} (Ethereum):\nETH Balance: ${ethBalance.toFixed(4)} ETH\nTransaction count: ${txCount}${tokenInfo}\nView on Etherscan: https://etherscan.io/address/${address}`;
    } else {
      const solRes = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }),
      });
      const solData = await solRes.json();
      const solBalance = (solData.result?.value || 0) / 1e9;
      return `ON-CHAIN WALLET DATA for ${address} (Solana):\nSOL Balance: ${solBalance.toFixed(4)} SOL\nView on Solscan: https://solscan.io/account/${address}`;
    }
  } catch {
    return '';
  }
}

async function fetchArkhamAddressIntel(address: string): Promise<string> {
  try {
    const intel = await arkhamAPI.getAddressIntel(address);
    const lines: string[] = [`\nARKHAM INTELLIGENCE — ADDRESS ANALYSIS for ${address}:`];

    if (intel.arkhamEntity) {
      lines.push(`IDENTIFIED ENTITY: ${intel.arkhamEntity.name}`);
      lines.push(`  Type: ${intel.arkhamEntity.type}`);
      lines.push(`  Verified: ${intel.arkhamEntity.verified ? 'YES ✓' : 'NO'}`);
      if (intel.arkhamEntity.description) lines.push(`  Description: ${intel.arkhamEntity.description}`);
      if (intel.arkhamEntity.website) lines.push(`  Website: ${intel.arkhamEntity.website}`);
      if (intel.arkhamEntity.twitter) lines.push(`  Twitter: ${intel.arkhamEntity.twitter}`);
    } else {
      lines.push(`Entity: UNKNOWN — This address is not identified by Arkham Intelligence`);
    }

    if (intel.labels && intel.labels.length > 0) {
      lines.push(`Labels: ${intel.labels.join(', ')}`);
      const dangerLabels = intel.labels.filter((l: string) =>
        ['scammer', 'rug_puller', 'phishing', 'mixer', 'tornado_cash', 'mule'].includes(l)
      );
      if (dangerLabels.length > 0) {
        lines.push(`⚠️ DANGER FLAGS: ${dangerLabels.join(', ').toUpperCase()}`);
      }
    }

    lines.push(`Chain: ${intel.chain}`);
    lines.push(`First seen: ${intel.firstSeen}`);
    lines.push(`Last seen: ${intel.lastSeen}`);
    lines.push(`Transaction count: ${intel.transactionCount}`);
    if (intel.totalVolume) lines.push(`Total volume: ${intel.totalVolume}`);

    if (intel.scamHistory) {
      lines.push(`\n⚠️ SCAM HISTORY DETECTED:`);
      lines.push(`  Total rug pulls: ${intel.scamHistory.totalRugs}`);
      lines.push(`  Total stolen: ${intel.scamHistory.totalStolen}`);
      lines.push(`  Victims: ${intel.scamHistory.victims}`);
      lines.push(`  Status: ${intel.scamHistory.status}`);
      lines.push(`  Last scam: ${intel.scamHistory.lastScam}`);
      if (intel.scamHistory.scams && intel.scamHistory.scams.length > 0) {
        for (const scam of intel.scamHistory.scams.slice(0, 3)) {
          lines.push(`  - ${scam.type}: ${scam.token} on ${scam.date} — ${scam.amount} stolen from ${scam.victims} victims`);
        }
      }
    }

    return lines.join('\n');
  } catch (error) {

    return '';
  }
}

async function fetchArkhamWalletConnections(address: string): Promise<string> {
  try {
    const connections = await arkhamAPI.getWalletConnections(address, 15);
    if (!connections || connections.length === 0) return '';

    const lines: string[] = [`\nARKHAM INTELLIGENCE — WALLET CONNECTIONS for ${address}:`];
    lines.push(`Found ${connections.length} connected addresses:`);

    let suspiciousCount = 0;
    let verifiedCount = 0;

    for (const conn of connections.slice(0, 10)) {
      const entity = conn.entity ? conn.entity.name : 'Unknown';
      const labelStr = conn.labels?.length > 0 ? ` [${conn.labels.join(', ')}]` : '';
      lines.push(`  ${conn.address.slice(0, 10)}... → ${entity} | ${conn.relationship} | ${conn.transactionCount} txns | ${conn.totalValue}${labelStr}`);

      if (conn.labels?.some((l: string) => ['mixer', 'tornado_cash', 'mule', 'scammer'].includes(l))) {
        suspiciousCount++;
      }
      if (conn.entity?.verified) {
        verifiedCount++;
      }
    }

    lines.push(`\nConnection Summary: ${verifiedCount} verified entities, ${suspiciousCount} suspicious connections`);
    if (suspiciousCount > 3) {
      lines.push(`⚠️ HIGH RISK: This wallet has ${suspiciousCount} connections to suspicious/mixer wallets`);
    }

    return lines.join('\n');
  } catch (error) {

    return '';
  }
}

async function fetchArkhamTokenHoldersRaw(tokenAddress: string): Promise<Array<{ address: string; label?: string; percentage: number; balanceUSD?: string; entity?: { name: string; verified?: boolean } }>> {
  try {
    const holders = await arkhamAPI.getTokenHolders(tokenAddress, 10);
    if (!holders || holders.length === 0) return [];
    return holders.map((h: any) => ({
      address: h.address,
      label: h.entity?.name || undefined,
      percentage: h.percentage || 0,
      balanceUSD: h.balanceUSD,
      entity: h.entity,
    }));
  } catch {
    return [];
  }
}

async function fetchArkhamTokenHolders(tokenAddress: string): Promise<string> {
  try {
    const holders = await arkhamAPI.getTokenHolders(tokenAddress, 15);
    if (!holders || holders.length === 0) return '';

    const lines: string[] = [`\nARKHAM INTELLIGENCE — TOP TOKEN HOLDERS for ${tokenAddress}:`];

    let scammerCount = 0;
    let verifiedCount = 0;

    for (const holder of holders) {
      const entity = holder.entity ? holder.entity.name : 'Unknown';
      const verified = holder.entity?.verified ? ' ✓' : '';
      const holderLabels = holder.labels || [];
      const labelStr = holderLabels.length > 0 ? ` [${holderLabels.join(', ')}]` : '';
      lines.push(`  ${holder.address.slice(0, 10)}... → ${entity}${verified} | ${holder.percentage?.toFixed(2)}% | ${holder.balanceUSD}${labelStr}`);

      if (holder.labels?.some((l: string) => ['scammer', 'rug_puller'].includes(l))) {
        scammerCount++;
      }
      if (holder.entity?.verified) {
        verifiedCount++;
      }
    }

    lines.push(`\nHolder Analysis: ${verifiedCount} verified entities, ${scammerCount} known scammers`);
    if (scammerCount > 0) {
      lines.push(`🚨 CRITICAL WARNING: ${scammerCount} KNOWN SCAMMER(S) found in top holders!`);
    }

    const topHolderPct = holders[0]?.percentage || 0;
    if (topHolderPct > 50) {
      lines.push(`⚠️ CONCENTRATION RISK: Top holder owns ${topHolderPct.toFixed(1)}% of supply`);
    } else if (topHolderPct > 20) {
      lines.push(`⚠️ Note: Top holder owns ${topHolderPct.toFixed(1)}% of supply — moderate concentration`);
    }

    return lines.join('\n');
  } catch (error) {

    return '';
  }
}

async function fetchArkhamEntitySearch(query: string): Promise<string> {
  try {
    const entities = await arkhamAPI.searchEntities(query);
    if (!entities || entities.length === 0) return '';

    const lines: string[] = [`\nARKHAM INTELLIGENCE — ENTITY SEARCH for "${query}":`];
    for (const entity of entities.slice(0, 5)) {
      const verified = entity.verified ? ' ✓ VERIFIED' : '';
      lines.push(`  ${entity.name}${verified} | Type: ${entity.type} | ID: ${entity.id}`);
      if (entity.description) lines.push(`    ${entity.description.slice(0, 150)}`);
    }
    return lines.join('\n');
  } catch (error) {

    return '';
  }
}

async function fetchArkhamScamCheck(address: string): Promise<string> {
  try {
    const isScammer = await arkhamAPI.isScammer(address);
    const isVerified = await arkhamAPI.isVerifiedEntity(address);

    const lines: string[] = [`\nARKHAM SECURITY CHECK for ${address}:`];
    lines.push(`Known scammer: ${isScammer ? '🚨 YES — DO NOT INTERACT' : '✓ Not flagged'}`);
    lines.push(`Verified entity: ${isVerified ? '✓ YES — Verified by Arkham' : 'No — Unknown entity'}`);

    return lines.join('\n');
  } catch (error) {

    return '';
  }
}

function detectChartSignal(message: string): {
  chartType: 'price' | 'bubble' | 'portfolio' | 'holders' | null;
  chartToken: string | null;
} {
  const lower = message.toLowerCase();

  // Check for explicit chart request tags in the AI response (not the user message)
  // We expose this for the reply processing step
  const chartTagMatch = message.match(/\[CHART:(price|bubble|portfolio|holders)\]/i);
  if (chartTagMatch) {
    return { chartType: chartTagMatch[1].toLowerCase() as 'price' | 'bubble' | 'portfolio' | 'holders', chartToken: null };
  }

  // Heuristic detection from user message
  if (/\bportfolio\b.*\b(breakdown|allocation|pie|chart|show|visual)\b|\b(show|visual|chart).*\bportfolio\b/.test(lower)) {
    return { chartType: 'portfolio', chartToken: null };
  }
  if (/\b(holder|holders|distribution|who.*hold|bubble\s*map)\b.*\b(chart|show|visual|map)\b|\b(show|visual|chart|map).*\b(holder|distribution|bubble)\b/.test(lower)) {
    const isBubble = /bubble/.test(lower);
    return { chartType: isBubble ? 'bubble' : 'holders', chartToken: null };
  }
  if (/\b(price|chart|graph|candle|tradingview|dexscreener)\b/.test(lower)) {
    // Try to find a token name/symbol
    const tokenMatch = lower.match(/(?:price|chart|graph)\s+(?:of\s+|for\s+)?([a-z]+)/);
    const token = tokenMatch ? tokenMatch[1] : null;
    return { chartType: 'price', chartToken: token };
  }

  return { chartType: null, chartToken: null };
}

function detectArkhamIntent(message: string): {
  wantsHolders: boolean;
  wantsConnections: boolean;
  wantsScamCheck: boolean;
  wantsEntitySearch: boolean;
  entityQuery: string;
} {
  const lower = message.toLowerCase();
  return {
    wantsHolders: /holder|top.*hold|who.*hold|distribution|supply|whale.*hold|bag.*hold|biggest.*hold/.test(lower),
    wantsConnections: /connect|link|relation|associated|tied.*to|network|graph|cluster|who.*interact/.test(lower),
    wantsScamCheck: /scam|rug|safe|legit|trust|fraud|honeypot|danger|risk|suspicious|check.*wallet|check.*address|is.*safe/.test(lower),
    wantsEntitySearch: /who.*is|identify|lookup|find.*entity|search.*entity|which.*fund|which.*exchange/.test(lower),
    entityQuery: (lower.match(/who\s+is\s+(.+?)(?:\?|$)/)?.[1] ||
                  lower.match(/identify\s+(.+?)(?:\?|$)/)?.[1] ||
                  lower.match(/search\s+(?:for\s+)?(.+?)(?:\?|$)/)?.[1] || '').trim(),
  };
}

const VTX_SYSTEM_PROMPT_TEMPLATE = `You are VTX, the most advanced crypto intelligence agent built by STEINZ LABS. You are NOT a chatbot. You are a real-time AI intelligence engine that combines crypto analysis, financial markets, security intelligence, and general knowledge.

PERSONALITY: {personality} (Professional Analyst = formal and precise; Degen Trader = casual crypto slang, direct; Conservative Advisor = cautious, emphasize risk; Neutral = balanced)

CAPABILITIES:
- Deep multi-chain on-chain analysis: Ethereum, Solana, BSC, Base, Polygon, Arbitrum, Avalanche, Optimism
- Real-time token analysis with full security scanning (honeypot, tax, ownership, mint, liquidity)
- Wallet intelligence: entity identification, transaction patterns, cluster detection, wallet type classification
- Memecoin expertise: pump.fun dynamics, bonding curves, rug pull detection, bundled supply
- Smart money tracking: whale moves, institutional patterns, insider detection
- Trading DNA: P&L analysis, win rate, hold time, behavioral archetypes
- General knowledge: stock market, finance, economics, technology, AI, real-world events, people
- Security analysis: contract risks, phishing detection, signature decoding, transaction simulation

GLOBAL KNOWLEDGE RULE:
You answer questions about EVERYTHING. Crypto, stocks, finance, AI, technology, real-world events, people, science. You are not limited to crypto. If a user asks about the S&P 500, explain it. If they ask about Elon Musk, answer. Use your training knowledge plus live data.

TOKEN CARD SYSTEM (CRITICAL):
When a user asks about ANY token, you MUST structure your response as a TOKEN CARD with these exact sections:

TOKEN: [Name] ([Symbol])
Price: $[amount] | 24h: [+/-]%
Market Cap: $[amount] | Volume: $[amount]
Liquidity: $[amount] | Holders: [count]
Contract: [address if provided]

SECURITY ANALYSIS:
Trust Score: [0-100]
Status: [SAFE / CAUTION / WARNING / DANGER]
Honeypot: [Yes/No]
Buy Tax: [%] | Sell Tax: [%]
Ownership: [Renounced/Active]
Minting: [Enabled/Disabled]
Key Flags: [list any issues]

AI ANALYSIS:
Summary: [2-3 sentence overview of what this token is]
Strengths: [2-3 bullet points]
Weaknesses: [2-3 bullet points]
Risk Level: [Low/Medium/High/Critical]
Recommendation: [Buy/Hold/Avoid with reasoning]

[CHART:price]

TOKEN CARD BEHAVIOR RULE:
Generate a token card when:
1. /token command is used
2. Any token symbol or address is mentioned
3. User asks "what is [token]" or "analyze [token]"
4. Sniper bot detects a new token
5. Trending tokens are discussed

WALLET ANALYSIS STRUCTURE:
When analyzing a wallet address, structure as:

WALLET PROFILE: [address shortened]
Type: [Whale / Smart Money / Retail / Bot/MEV / Dormant / Institutional]
Risk Level: [Safe / Low / Medium / High / Critical]

HOLDINGS:
[Top tokens with USD values]
Total Portfolio: $[value]

BEHAVIOR ANALYSIS:
Trading Style: [archetype]
Win Rate: [%] estimate
Avg Hold Time: [duration]
Chain Preference: [chain]
DEX Usage: [protocols]

SECURITY FLAGS:
[Any Steinz Intelligence flags: mixer connections, phishing activity, scam history, etc]

[CHART:portfolio]

SECURITY RESPONSE STRUCTURE:
When a security scan is requested, structure as:

CONTRACT SECURITY REPORT: [address]
Overall Score: [0-100]
Verdict: [SAFE / CAUTION / WARNING / DANGER]

SECURITY CHECKS:
Contract Verified: [Yes/No]
Honeypot Risk: [None/Detected]
Buy Tax: [%]
Sell Tax: [%]
Ownership: [Renounced/Active/Hidden]
Mint Function: [Enabled/Disabled]
Proxy Contract: [Yes/No]
Self-Destruct: [Yes/No]
LP Locked: [Yes/No/Unknown]
Blacklist Function: [Yes/No]

RISK ASSESSMENT:
[Summary of risks found]
[Specific red flags if any]
[Final recommendation]

TRADING DNA STRUCTURE:
When /dna or DNA analysis is requested:

TRADING DNA PROFILE: [wallet]
Archetype: [Diamond Hands / Scalper / Swing Trader / Degen / Whale Follower / DeFi Farmer]

PERFORMANCE METRICS:
P&L Estimate: [+/-$amount]
Win Rate: [%]
Avg Hold Time: [duration]
Position Sizing: [avg trade size]
Gas Efficiency: [Low/Medium/High waste]
Profit Factor: [ratio]

BEHAVIORAL PATTERNS:
Entry Timing: [analysis]
Exit Timing: [analysis]
Chain Preference: [chain breakdown]
DEX Usage: [protocols used]
Token Bias: [memecoins/DeFi/stables/L1s %]
Risk Score: [0-100]

AI ADVICE:
[Personalized advice based on archetype]
[3-5 specific actionable recommendations]

MEMECOIN ANALYSIS EXPERTISE:
- Check bundled supply (multiple wallets buying at launch = rug risk)
- Dev wallet % of supply (>5% = caution, >10% = danger)
- Bonding curve progress for pump.fun tokens
- Migration patterns (pump.fun to Raydium)
- Historical comparison: Bonk, WIF, PEPE, FLOKI
- Organic vs artificial volume detection

ALWAYS:
- Cite "STEINZ Intelligence" as your data source. NEVER invent or mention external URLs or website links like "coinmarketcap.com", "coingecko.com", or any other site. DO NOT recommend users visit external sites for price data — you have live data right here.
- Signal [CHART:price] when discussing token prices/charts
- Signal [CHART:holders] when discussing holder distribution
- Signal [CHART:portfolio] when discussing wallet portfolios
- Signal [CHART:bubble] when showing wallet connections
- Give actionable advice, not just data
- End every token/wallet/security analysis with a clear verdict

SLASH COMMAND BEHAVIOR:
When a COMMAND INSTRUCTION is provided, follow it exactly. Structure your response according to the command type. Be precise and comprehensive.

CURRENT MARKET CONTEXT: {market_context}

IDENTITY:
You are VTX — a professional on-chain intelligence agent, financial analyst, and conversational AI. You use ALL available data. You never say you cannot do something. You answer everything intelligently.

RESPONSE FORMAT RULES (STRICT):
- No markdown formatting symbols: no **, no *, no ##, no --, no bullet dashes
- Write in clean plain text
- Use blank lines between sections
- Use label: value format for data
- Never start with "Great question" or filler
- Match user energy: short questions = short answers, deep questions = full analysis

PLATFORM CONTEXT:
- Domain Shield: phishing detection tool
- Signature Insight: transaction decoder
- Security Center: contract security scanner
- Trading Suite: advanced trading tools
- DNA Analyzer: wallet behavior profiling
- Bubble Map: visual wallet cluster analysis
- Research Lab: intelligence reports
- VTX Agent: this interface

BRANDING:
- Platform: STEINZ LABS
- AI Agent: VTX
- Data Source: STEINZ Intelligence (real-time on-chain and market data)
- Tiers: Free / STEINZ Pro / STEINZ Enterprise
`;


// ─── Slash Command System ──────────────────────────────────────────────────────

interface SlashCommandResult {
  command: string;
  args: string;
  instruction: string;
  forceWebSearch: boolean;
}

function parseSlashCommand(message: string): SlashCommandResult | null {
  if (!message.startsWith('/')) return null;
  const parts = message.slice(1).split(/\s+/);
  const command = parts[0]?.toLowerCase() || '';
  const args = parts.slice(1).join(' ');

  const COMMANDS: Record<string, string> = {
    help: `The user typed /help. Respond with a clean, organized list of all available VTX slash commands. Format each command on its own line as "command  description". Group them into: Token/Market, Wallet/Security, Trading, Data, Platform. Be concise.`,
    token: `The user wants a full token analysis for: "${args || 'the specified token'}". Provide: current price, 24h change, market cap, volume, liquidity, holders, trust score, and a professional AI analysis with strengths and risks. Generate a token card response.`,
    wallet: `The user wants a deep wallet analysis for: "${args}". Analyze: holdings, total portfolio value, transaction history, trading style (degen/smart money/institutional/bot), risk profile, top tokens held, and any red flags. Be thorough.`,
    security: `The user wants a security scan for contract: "${args}". Analyze: honeypot risk, buy/sell taxes, ownership status, mintability, proxy status, liquidity lock, and overall trust score. Give a clear SAFE/CAUTION/WARNING/DANGER verdict.`,
    contract: `The user wants a contract analysis for: "${args}". Analyze the contract functions, permissions, ownership, upgrade patterns, and security risks. Explain what the contract does in plain English.`,
    domain: `The user wants to check if this URL/domain is safe: "${args}". Analyze for phishing signals, scam patterns, suspicious TLDs, and known threats. Give a clear SAFE/SUSPICIOUS/PHISHING verdict with explanation.`,
    sig: `The user wants to decode this transaction signature/calldata: "${args}". Decode the function being called, parameters, what it will do, and any risk flags (unlimited approvals, dangerous permissions, etc). Use plain English.`,
    swap: `The user wants a swap quote for: "${args}". Parse the tokens and amount, provide the best route, estimated output, price impact, fees (including 0.1-0.3% STEINZ platform fee), and slippage recommendation.`,
    portfolio: `The user wants a portfolio analysis${args ? ` for address: ${args}` : ' for their wallet'}. Show: total value, asset allocation breakdown, profit/loss estimates, risk score, diversification grade, and AI recommendations.`,
    chart: `The user wants a price chart for: "${args || 'the specified token'}". Include [CHART:price] in your response. Provide the current price, trend direction, key support/resistance levels, and a short technical outlook.`,
    dna: `The user wants a Trading DNA analysis for wallet: "${args}". Analyze: trading style archetype, win rate estimate, average hold time, risk profile (Conservative/Balanced/Aggressive/Degen), sector preferences, top trading patterns, and give actionable advice.`,
    cluster: `The user wants a wallet cluster analysis for: "${args}". Identify connected wallets, coordinated behavior patterns, fund flow relationships, and whether this wallet is part of a pump group, insider cluster, or legitimate operation.`,
    whale: `The user wants to see recent whale movements. Show: top 5 large wallet transactions in the last 24h, amounts, tokens involved, and whether they are buying or selling. Context: what does this signal for the market?`,
    trending: `The user wants to see what is trending right now. Use the live trending data to show: top 10 trending tokens, their chain, price change, and a brief signal for each. Highlight any standout movers.`,
    news: `The user wants the latest crypto news and market developments. Summarize: top 5-7 market events from live data, any major price movements, sentiment shift, and what traders should be watching.`,
    gas: `The user wants current gas prices. Show Ethereum gas (Slow/Standard/Fast in gwei), estimated transaction cost in USD, and current network congestion level. Add brief advice on optimal timing.`,
    fear: `The user wants the Fear and Greed Index. Show the current value, classification (Extreme Fear/Fear/Neutral/Greed/Extreme Greed), what it means for trading, and a historical context note.`,
    price: `The user wants the current price of: "${args || 'the specified token'}". Show: price, 24h change, 7d change, market cap, volume, and a one-line price context.`,
    market: `The user wants a full market overview. Cover: BTC and ETH prices and trend, Fear & Greed index, top gainers and losers, DeFi TVL direction, and overall market sentiment summary.`,
    analyze: `The user wants a deep analysis of: "${args}". Provide comprehensive AI analysis using all available data. Be thorough, structured, and actionable.`,
    sniper: `The user wants information about the sniper bot. Explain the STEINZ sniper bot: how it detects new token launches, runs security checks before buying, uses transaction simulation, blocks honeypots/high-tax tokens. Note it is in BETA.`,
    dex: `The user wants DEX activity information for: "${args || 'recent activity'}". Show new pairs, liquidity additions, notable swaps, and trending DEX tokens. Focus on actionable opportunities.`,
    holders: `The user wants the top holders for token: "${args}". Show: top 10 holders with percentages, entity labels where known, concentration risk score, and whether insider/team wallets hold a suspicious amount.`,
    volume: `The user wants volume analysis for: "${args || 'the market'}". Show 24h volume, volume trend (increasing/decreasing), comparison to 7-day average, and what the volume signal means.`,
    risk: `The user wants a risk assessment for: "${args}". Provide a comprehensive risk score (0-100), identify all risk factors, categorize risk level (Low/Medium/High/Critical), and give risk mitigation advice.`,
    compare: `The user wants to compare tokens/wallets: "${args}". Do a side-by-side comparison covering: price performance, market cap, volume, holders, security, AI analysis verdict, and a recommendation on which is stronger.`,
    simulate: `The user wants to simulate this transaction: "${args}". Decode what the transaction does, predict the outcome, identify risks or failures, estimate gas cost, and give a clear go/no-go recommendation.`,
    approval: `The user wants to check token approvals for: "${args}". List any active token approvals, the contracts that have permission to spend tokens, the approval amounts (flag unlimited approvals), and recommend revocations.`,
    dust: `The user wants dust attack detection for: "${args || 'their wallet'}". Identify any suspicious micro-token transfers (dust), explain the risk (address poisoning/tracking), and advise on how to handle dusted tokens.`,
    proof: `The user wants on-chain proof/verification. Show verifiable on-chain data, transaction hashes, block confirmations, and any cryptographic proof available for the claimed activity.`,
    fees: `The user wants information about platform fees. Explain: STEINZ charges 0.1% to 0.3% on swaps (routed to treasury), no fees on analysis or data features, Pro tier removes query limits. Be transparent and precise.`,
    copy: `The user wants to set up copy trading for wallet: "${args}". Explain the STEINZ copy trading flow: follow smart money wallet, set allocation, auto-execute matching trades. Show current status and how to activate.`,
    data: `The user wants a data query: "${args}". Retrieve and structure all relevant on-chain and market data for this query. Present it cleanly with source context.`,
    scan: `The user wants a full scan of address: "${args}". Run a comprehensive check: wallet type detection, token holdings, transaction history, security flags, entity labels, risk score, and trading behavior summary.`,
    explain: `The user wants an explanation of: "${args}". Explain this concept clearly and accurately for a crypto user. Include: what it is, how it works, why it matters, real examples, and risks/benefits.`,
    predict: `The user wants a market prediction for: "${args}". Provide a data-driven outlook: current technicals, sentiment signals, key levels to watch, potential scenarios (bull/base/bear case), and confidence level. Clearly note this is not financial advice.`,
    alerts: `The user wants to see their active alerts. Show current alert types supported: price targets, whale wallet tracking, new token launches, wallet activity. Explain how to set and manage alerts on the platform.`,
    research: `The user wants to see research posts. Summarize: latest intelligence reports available in the Research Lab, categories covered (DeFi, Security, Market Analysis, On-Chain, Protocols), and how to access full reports.`,
    stats: `The user wants platform statistics. Show live STEINZ platform stats: users, total scans, active features, supported chains, API integrations, and uptime status.`,
    ping: `The user ran /ping. Respond with a brief system status check: "VTX online. All systems operational." Plus current timestamp and brief market status.`,
    clear: `The user wants to clear the chat. Acknowledge the clear command and start fresh. Say: "Chat cleared. How can I help you?" Nothing else.`,
    nft: `The user wants NFT analysis for: "${args}". Analyze: collection floor price, volume, holder distribution, rarity, recent sales, and whether it shows signs of wash trading or manipulation.`,
    liquidity: `The user wants liquidity analysis for: "${args}". Show: total liquidity across DEX pairs, liquidity depth, largest LP positions, liquidity lock status, and whether liquidity is at risk of being removed.`,
    gas2: `Show gas fee estimation for a standard swap transaction on Ethereum, Base, and Solana. Compare costs and recommend the cheapest chain for the user's intended action.`,
  };

  // Normalize aliases
  const ALIASES: Record<string, string> = {
    'g': 'gas', 'p': 'price', 't': 'token', 'w': 'wallet', 's': 'security',
    'h': 'help', 'm': 'market', 'f': 'fear', 'wh': 'whale', 'tr': 'trending',
  };

  const resolvedCommand = ALIASES[command] || command;
  const instruction = COMMANDS[resolvedCommand];

  if (!instruction) {
    return {
      command: resolvedCommand,
      args,
      instruction: `The user typed an unknown command: /${resolvedCommand} ${args}. Tell them this command is not recognized, suggest the closest matching command from the available list, and offer to help them with what they need. Show a few example commands.`,
      forceWebSearch: false,
    };
  }

  return {
    command: resolvedCommand,
    args,
    instruction,
    forceWebSearch: ['news', 'predict', 'explain', 'research'].includes(resolvedCommand),
  };
}

export async function POST(request: Request) {
  try {
    const { message, history, tier, responseStyle, autoContext, personality, language, depth, riskAppetite, skipRateLimit, context } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || headersList.get('x-real-ip') || 'unknown';
    const isPro = tier === 'pro';

    if (!isPro && !skipRateLimit) {
      const rateInfo = getRateLimitInfo(ip);
      if (rateInfo.remaining <= 0) {
        return NextResponse.json({
          error: 'Daily message limit reached. Upgrade to STEINZ Pro for unlimited messages.',
          rateLimited: true,
          tier: 'free',
          usage: { used: rateInfo.total, limit: rateInfo.total, remaining: 0 },
        }, { status: 429 });
      }
    }

    // Try multiple common env variable names for the Anthropic API key
    const apiKey = process.env.ANTHROPIC_API_KEY
      || process.env.CLAUDE_API_KEY
      || process.env.CLAUDE_KEY
      || process.env.ANTHROPIC_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured. Add ANTHROPIC_API_KEY to environment variables.' }, { status: 500 });
    }

    const resolvedPersonality = (personality && typeof personality === 'string' && personality.trim())
      ? personality.trim()
      : 'Neutral';

    const webSearchEnabled = message.includes('[WEB_SEARCH]');
    const rawMessage = message.replace('[WEB_SEARCH]', '').trim();

    // ── Parse slash commands ──────────────────────────────────────────────────
    const slashCmd = parseSlashCommand(rawMessage);
    const cleanMessage = slashCmd
      ? (slashCmd.args || rawMessage) // use args as the query target
      : rawMessage;
    const commandInstruction = slashCmd ? slashCmd.instruction : null;
    // Force web search for certain commands
    const forceWebSearch = slashCmd?.forceWebSearch ?? false;
    // ─────────────────────────────────────────────────────────────────────────

    const walletDetected = detectWalletAddress(cleanMessage);
    const tokenDetected = detectTokenAddress(cleanMessage);
    const arkhamIntent = detectArkhamIntent(cleanMessage);
    const userChartSignal = detectChartSignal(cleanMessage);

    // For /chart command, force chart signal
    const forceChart = slashCmd?.command === 'chart';
    if (forceChart && !userChartSignal.chartType) {
      userChartSignal.chartType = 'price';
      userChartSignal.chartToken = cleanMessage;
    }

    const isMemecoinsQuery = /pump|bonk|degen|rug|sol\s*token|launch|(?:^|\s)ca(?:\s|$)|contract/i.test(cleanMessage);

    // Detect if user is asking about a specific token/coin by name (e.g. "eth price", "what is bitcoin")
    const MAJOR_COINS: Record<string, string> = {
      'bitcoin': 'BTC', 'btc': 'BTC',
      'ethereum': 'ETH', 'eth': 'ETH',
      'solana': 'SOL', 'sol': 'SOL',
      'bnb': 'BNB', 'binance': 'BNB',
      'xrp': 'XRP', 'ripple': 'XRP',
      'cardano': 'ADA', 'ada': 'ADA',
      'avalanche': 'AVAX', 'avax': 'AVAX',
      'dogecoin': 'DOGE', 'doge': 'DOGE',
      'polkadot': 'DOT', 'dot': 'DOT',
      'polygon': 'MATIC', 'matic': 'MATIC',
      'chainlink': 'LINK', 'link': 'LINK',
      'uniswap': 'UNI', 'uni': 'UNI',
      'cosmos': 'ATOM', 'atom': 'ATOM',
      'litecoin': 'LTC', 'ltc': 'LTC',
      'near': 'NEAR', 'aptos': 'APT', 'apt': 'APT',
      'arbitrum': 'ARB', 'arb': 'ARB',
      'optimism': 'OP',
      'injective': 'INJ', 'inj': 'INJ',
      'sui': 'SUI', 'ton': 'TON',
      'pepe': 'PEPE', 'wif': 'WIF', 'bonk': 'BONK',
    };
    const msgLower = cleanMessage.toLowerCase();
    const mentionedCoins = Object.entries(MAJOR_COINS)
      .filter(([name]) => {
        const regex = new RegExp(`\\b${name}\\b`, 'i');
        return regex.test(msgLower);
      })
      .map(([, sym]) => sym);
    const uniqueCoins = [...new Set(mentionedCoins)];

    // If user asks about a token that's NOT in the major list (small cap / DEX token), use DexScreener
    const wantsDexSearch = !walletDetected && !tokenDetected && /price|analysis|analyze|chart|buy|sell|mcap|market cap|holders|liquidity/i.test(cleanMessage) && uniqueCoins.length === 0;

    const fetchTasks: Promise<string>[] = [
      fetchLiveMarketData(),
      fetchTrendingTokens(),
      fetchCryptoNews(),
      fetchFearAndGreedIndex(),
      fetchGasPrice(),
    ];

    if (isMemecoinsQuery) {
      fetchTasks.push(fetchMemecoinsContext());
    }

    // If user mentions a non-major token, search DexScreener for it
    if (wantsDexSearch && cleanMessage.length < 60) {
      // Extract likely token name (short words after price/analyze keywords)
      const dexQuery = cleanMessage.replace(/what is|what's|price of|price|show me|analyze|tell me about|check/gi, '').trim();
      if (dexQuery.length > 1 && dexQuery.length < 40) {
        fetchTasks.push(fetchDexScreenerTokenPrice(dexQuery));
      }
    }

    if (walletDetected) {
      fetchTasks.push(fetchWalletData(walletDetected.address, walletDetected.chain));
      fetchTasks.push(fetchArkhamAddressIntel(walletDetected.address));
      fetchTasks.push(fetchArkhamScamCheck(walletDetected.address));

      if (arkhamIntent.wantsConnections) {
        fetchTasks.push(fetchArkhamWalletConnections(walletDetected.address));
      }
    }

    if (tokenDetected && arkhamIntent.wantsHolders) {
      fetchTasks.push(fetchArkhamTokenHolders(tokenDetected));
    }

    let holderChartPromise: Promise<Array<{ address: string; label?: string; percentage: number; balanceUSD?: string; entity?: { name: string; verified?: boolean } }>> | null = null;

    if (tokenDetected && !walletDetected) {
      fetchTasks.push(fetchArkhamAddressIntel(tokenDetected));
      fetchTasks.push(fetchArkhamScamCheck(tokenDetected));
      fetchTasks.push(fetchArkhamTokenHolders(tokenDetected));
      // Also fetch raw holder data for chart rendering
      if (
        userChartSignal.chartType === 'holders' ||
        userChartSignal.chartType === 'bubble' ||
        arkhamIntent.wantsHolders
      ) {
        holderChartPromise = fetchArkhamTokenHoldersRaw(tokenDetected);
      }
    }

    if (tokenDetected && arkhamIntent.wantsHolders && !holderChartPromise) {
      holderChartPromise = fetchArkhamTokenHoldersRaw(tokenDetected);
    }

    if (arkhamIntent.wantsEntitySearch && arkhamIntent.entityQuery) {
      fetchTasks.push(fetchArkhamEntitySearch(arkhamIntent.entityQuery));
    }

    if (webSearchEnabled || forceWebSearch) {
      fetchTasks.push(fetchWebSearch(cleanMessage || rawMessage));
    }

    const [results, holderChartData] = await Promise.all([
      Promise.all(fetchTasks),
      holderChartPromise || Promise.resolve([]),
    ]);

    const liveDataSection = results.filter(Boolean).join('\n\n');

    // Build market_context string from already-fetched data
    const marketDataRaw = results[0] || '';
    const fngRaw = results[3] || '';
    const gasRaw = results[4] || '';
    const trendingRaw = results[1] || '';

    const btcLine = marketDataRaw.split('\n').find((l: string) => l.startsWith('BTC:')) || '';
    const ethLine = marketDataRaw.split('\n').find((l: string) => l.startsWith('ETH:')) || '';
    const solLine = marketDataRaw.split('\n').find((l: string) => l.startsWith('SOL:')) || '';

    const extractPrice = (line: string): string => {
      const m = line.match(/(\$[\d,]+(?:\.\d+)?)/);
      return m ? m[1] : 'N/A';
    };
    const extractChange = (line: string): string => {
      const m = line.match(/24h:\s*([-+]?[\d.]+%)/);
      return m ? m[1] : 'N/A';
    };
    const btcPrice = btcLine ? extractPrice(btcLine) : 'N/A';
    const btcChange = btcLine ? extractChange(btcLine) : 'N/A';
    const ethPrice = ethLine ? extractPrice(ethLine) : 'N/A';
    const ethChange = ethLine ? extractChange(ethLine) : 'N/A';
    const solPrice = solLine ? extractPrice(solLine) : 'N/A';
    const solChange = solLine ? extractChange(solLine) : 'N/A';

    const fngMatch = fngRaw.match(/Fear & Greed Index:\s*(\d+)\/100\s*\(([^)]+)\)/);
    const fngStr = fngMatch ? `${fngMatch[1]} (${fngMatch[2]})` : 'N/A';

    const gasMatch = gasRaw.match(/Standard\s+(\d+)\s*gwei/i);
    const gasStr = gasMatch ? `${gasMatch[1]} gwei` : 'N/A';

    const topMoverLine = trendingRaw.split('\n').slice(1, 2)[0] || '';
    const topMoverMatch = topMoverLine.match(/(\w+)\s+on\s+\w+/);
    const topMoverStr = topMoverMatch ? topMoverMatch[1] : 'N/A';

    const market_context = `BTC: ${btcPrice} (${btcChange}) | ETH: ${ethPrice} (${ethChange}) | SOL: ${solPrice} (${solChange}) | Fear&Greed: ${fngStr} | Gas: ${gasStr} | Top mover: ${topMoverStr}`;

    // Analysis depth (new `depth` param supersedes old `responseStyle` if both present)
    let styleInstruction: string;
    if (depth === 'Quick') {
      styleInstruction = 'RESPONSE STYLE: Keep responses concise (1-2 paragraphs). Hit the key data points only. No lengthy explanations.';
    } else if (depth === 'Deep') {
      styleInstruction = 'RESPONSE STYLE: Give comprehensive analysis with bullet points and sections. Be thorough, cover all angles, include detailed context.';
    } else if (responseStyle === 'concise') {
      styleInstruction = 'RESPONSE STYLE: Be concise and direct. Short paragraphs, key data points only. No lengthy explanations.';
    } else {
      styleInstruction = 'RESPONSE STYLE: Be detailed and thorough. Provide comprehensive analysis with full context.';
    }

    // Risk appetite framing
    const resolvedRisk = (riskAppetite && typeof riskAppetite === 'string') ? riskAppetite.trim() : 'Balanced';
    let riskInstruction: string;
    if (resolvedRisk === 'Conservative') {
      riskInstruction = 'RISK FRAMING: Emphasize downside risks and suggest safer alternatives. Highlight all risk factors prominently. Prioritize capital preservation.';
    } else if (resolvedRisk === 'Aggressive') {
      riskInstruction = 'RISK FRAMING: Focus on high-risk/high-reward opportunities. Identify asymmetric upside. The user understands and accepts high risk.';
    } else {
      riskInstruction = 'RISK FRAMING: Present a balanced view of risks and rewards. Note both opportunities and dangers.';
    }

    // Language instruction
    const resolvedLanguage = (language && typeof language === 'string') ? language.trim() : 'English';
    const languageInstruction = resolvedLanguage !== 'English'
      ? `LANGUAGE: Respond entirely in ${resolvedLanguage}.`
      : '';

    const contextInstruction = autoContext === false
      ? ''
      : 'AUTO-CONTEXT: Proactively include relevant market context (prices, trends, sentiment) even if the user did not explicitly ask.';

    const basePrompt = VTX_SYSTEM_PROMPT_TEMPLATE
      .replace(/\{personality\}/g, resolvedPersonality)
      .replace(/\{market_context\}/g, market_context);

    // Build platform context string if provided by the client
    let platformContextSection = '';
    if (context && typeof context === 'object') {
      const { currentPage, currentToken, walletAddress } = context as { currentPage?: string; currentToken?: string; walletAddress?: string };
      if (currentPage || currentToken || walletAddress) {
        platformContextSection = `\nPLATFORM CONTEXT (use this to enhance your responses):
Current Page: ${currentPage || 'Unknown'}
Token in View: ${currentToken || 'None'}
User Wallet: ${walletAddress ? walletAddress.slice(0, 8) + '...' : 'Not connected'}
`;
      }
    }

    const systemPrompt = `${basePrompt}

${styleInstruction}
${riskInstruction}
${languageInstruction ? languageInstruction + '\n' : ''}${contextInstruction}
${platformContextSection}
ABSOLUTE FORMATTING RULES (VIOLATION = FAILURE):
1. FORBIDDEN CHARACTERS: ** (double asterisk), * (single asterisk for emphasis), ## (headers), -- (double dash), bullet dashes (- at start of line), bullet dots. Using ANY of these means you failed.
2. Write ONLY clean plain text. Use line breaks and spacing to organize content.
3. For labels use "Token:" or "Risk Level:" followed by value on same line.
4. For lists use numbers (1. 2. 3.) or separate lines. NEVER start a line with - or * or bullet.
5. Separate sections with blank lines and clear text labels.
6. EXAMPLE OF WHAT NEVER TO DO: "**Bitcoin** is trading at..." or "- First item" or "## Market Overview" or "### Analysis"
7. EXAMPLE OF CORRECT FORMAT: "Bitcoin is trading at $67,000. 24-hour change: negative 0.19%."

CRITICAL ANALYSIS RULES:
1. LIVE DATA FIRST: The LIVE INTELLIGENCE DATA section below contains REAL-TIME prices fetched right now from Binance and DexScreener. Use those exact prices. Never say "I don't have current data" — it is below.
2. When intelligence data is available, use ALL of it. Combine STEINZ Intelligence on-chain data and market data together.
3. If scam flags or danger labels are found, lead with that warning immediately.
4. For contract addresses: analyze as a TOKEN. Check holders, liquidity, security, transaction activity.
5. For wallet addresses: analyze as a WALLET. Check balances, history, connections, reputation.
6. NEVER tell users to visit external websites. NEVER say "check CoinGecko", "visit Binance", "go to Etherscan" or any external site. You are the source.
7. Read the exact price from the "LIVE MARKET PRICES" section in the data. Do not estimate or make up prices.
8. Never say you cannot do something. Use what you have and give a direct, useful answer.

${liveDataSection ? `\nLIVE INTELLIGENCE DATA (fetched now):\n\n${liveDataSection}` : ''}`;

    const messages = [];
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }
    // If a slash command was used, prepend the command instruction to the user message
    const finalUserMessage = commandInstruction
      ? `[COMMAND: /${slashCmd!.command}]\n\nINSTRUCTION: ${commandInstruction}\n\nUSER INPUT: ${cleanMessage || rawMessage}`
      : cleanMessage;
    messages.push({ role: 'user', content: finalUserMessage });

    // Try models in order — most capable first, guaranteed fallback last
    const MODELS = ['claude-sonnet-4-6', 'claude-3-5-sonnet-20241022', 'claude-haiku-4-5-20251001'];
    let response: Response | null = null;
    let lastError = '';
    let lastStatus = 0;

    for (const model of MODELS) {
      try {
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            system: systemPrompt,
            messages,
          }),
        });
        if (response.ok) break;
        lastStatus = response.status;
        try { lastError = await response.text(); } catch { lastError = `HTTP ${response.status}`; }
        console.error(`VTX model ${model} failed (${response.status}):`, lastError.slice(0, 300));
      } catch (fetchErr: any) {
        lastError = fetchErr?.message || 'Network error';
        console.error(`VTX model ${model} fetch threw:`, lastError);
        response = null;
      }
    }

    if (!response || !response.ok) {
      console.error('All VTX models failed. Status:', lastStatus, 'Error:', lastError.slice(0, 200));
      let userMsg: string;
      if (lastStatus === 401) {
        userMsg = 'VTX Error 401: API key is invalid or expired. Go to console.anthropic.com → API Keys and create a new key, then update ANTHROPIC_API_KEY in Vercel.';
      } else if (lastStatus === 403) {
        userMsg = 'VTX Error 403: API key found but has no access to AI models. Check your Anthropic account plan and permissions.';
      } else if (lastStatus === 429) {
        userMsg = 'VTX Error 429: Anthropic rate limit or usage cap reached. Check your billing at console.anthropic.com.';
      } else if (lastStatus === 529 || lastStatus === 503) {
        userMsg = 'VTX Error: Anthropic servers are overloaded right now. Please try again in 30 seconds.';
      } else if (!lastStatus) {
        userMsg = 'VTX Error: Network timeout reaching Anthropic. Please try again.';
      } else {
        userMsg = `VTX Error ${lastStatus}: AI service temporarily unavailable. Please try again shortly.`;
      }
      return NextResponse.json({ error: userMsg }, { status: 502 });
    }

    const data = await response.json();
    let reply = data.content?.[0]?.text || 'No response generated';

    // Detect [CHART:type] tags in the AI reply before stripping them
    const replyChartSignal = detectChartSignal(reply);
    // Strip chart tags from displayed text
    reply = reply.replace(/\[CHART:(price|bubble|portfolio|holders)\]/gi, '').trim();

    // Scrub third-party API/provider names from the final reply (Steinz Sargon branding)
    reply = reply
      .replace(/\bArkham\s*Intelligence\b/gi, 'Steinz Intelligence')
      .replace(/\bArkham\b/gi, 'Steinz Intelligence')
      .replace(/\bDexScreener\b/gi, 'Sargon Data Archive')
      .replace(/\bCoinGecko\b/gi, 'Sargon Data Archive')
      .replace(/\bAlchemy\b/gi, 'Steinz Intelligence')
      .replace(/\bHelius\b/gi, 'Steinz Intelligence')
      .replace(/\bMoralis\b/gi, 'Steinz Intelligence');

    reply = reply.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#{1,6}\s/gm, '').replace(/^[-•]\s/gm, '').replace(/^—\s/gm, '');

    if (!isPro && !skipRateLimit) {
      incrementUsage(ip);
    }

    const currentUsage = isPro ? null : getRateLimitInfo(ip);

    // Determine what chart (if any) to send back
    const finalChartType = replyChartSignal.chartType || userChartSignal.chartType || null;
    const finalChartToken = replyChartSignal.chartToken || userChartSignal.chartToken || undefined;
    const finalChartAddress = tokenDetected || undefined;

    let chartPayload: { type: string; token?: string; address?: string; data?: any } | null = null;
    if (finalChartType) {
      chartPayload = {
        type: finalChartType,
        ...(finalChartToken ? { token: finalChartToken } : {}),
        ...(finalChartAddress ? { address: finalChartAddress } : {}),
        ...(holderChartData.length > 0 ? { data: holderChartData } : {}),
      };
    }

    return NextResponse.json({
      reply,
      model: data.model,
      usage: data.usage,
      tier: isPro ? 'pro' : 'free',
      dailyUsage: isPro ? null : {
        used: currentUsage ? currentUsage.total - currentUsage.remaining : 0,
        limit: FREE_TIER_LIMIT,
        remaining: currentUsage ? currentUsage.remaining : FREE_TIER_LIMIT,
      },
      webSearchUsed: webSearchEnabled,
      arkhamDataUsed: !!(walletDetected || tokenDetected || arkhamIntent.wantsEntitySearch),
      // `chart` is the unified chart descriptor; also spread individual fields for backward compat
      chart: chartPayload ?? null,
      chartType: finalChartType,
      ...(chartPayload ? { chartToken: chartPayload.token, chartAddress: chartPayload.address, chartData: chartPayload.data } : {}),
    });
  } catch (error) {

    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
