import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { arkhamAPI } from '@/lib/arkham/api';

const FREE_TIER_LIMIT = 15;
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
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=1h,24h,7d',
      {
        headers: process.env.COINGECKO_API_KEY
          ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
          : {},
        next: { revalidate: 30 },
      }
    );
    if (!res.ok) return '';
    const coins = await res.json();
    const lines = coins.map((c: any) =>
      `${c.symbol.toUpperCase()}: $${c.current_price?.toLocaleString()} (24h: ${c.price_change_percentage_24h?.toFixed(1)}%, 7d: ${c.price_change_percentage_7d_in_currency?.toFixed(1)}%, MCap: $${(c.market_cap / 1e9).toFixed(1)}B, Vol: $${(c.total_volume / 1e6).toFixed(0)}M)`
    );
    return lines.join('\n');
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
      ? 'Current hot tokens from Sargon Data Archive:\n' + lines.join('\n')
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
    console.error('Arkham address intel fetch failed:', error);
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
    console.error('Arkham connections fetch failed:', error);
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
    console.error('Arkham holders fetch failed:', error);
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
    console.error('Arkham entity search failed:', error);
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
    console.error('Arkham scam check failed:', error);
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

const VTX_SYSTEM_PROMPT_TEMPLATE = `You are VTX, the most advanced crypto intelligence agent powered by Steinz {Sargon} Intelligence — the industry's best proprietary data archive. You have access to real-time on-chain data, market intelligence, and deep network analysis.

PERSONALITY: {personality} (adjust tone based on this setting: Professional Analyst = formal and precise; Degen Trader = casual, use crypto slang, be direct; Conservative Advisor = cautious, emphasize risk; Neutral = balanced)

CAPABILITIES:
- Deep on-chain analysis for Ethereum, Solana, BSC, Base, Polygon, Arbitrum, Avalanche
- Real-time token analysis: price, holders, liquidity, risk scoring
- Wallet intelligence: entity identification, transaction patterns, connected wallets
- Memecoin expertise: pump.fun dynamics, bonding curve analysis, rug pull detection, bundled supply patterns
- Smart money tracking: identify whale moves, institutional patterns, copy-worthy wallets
- Risk assessment: contract security, holder concentration, liquidity depth

MEMECOIN ANALYSIS EXPERTISE:
When analyzing memecoins (especially on Solana/pump.fun):
- Check if supply is bundled (multiple wallets buying at launch = rug risk)
- Analyze dev wallet % of supply (>5% = caution, >10% = danger)
- Check bonding curve progress (for pump.fun tokens)
- Look for migration patterns (pump.fun to Raydium)
- Historical comparison: similar launches to Bonk, WIF, PEPE, FLOKI
- Organic vs artificial volume detection
- Community strength indicators

ALWAYS:
- Cite "Steinz {Sargon} Intelligence" as your data source, never mention third-party API names
- When discussing a token's price/chart, signal [CHART:price] in your response
- When discussing holder distribution, signal [CHART:holders]
- When discussing a wallet's portfolio, signal [CHART:portfolio]
- When showing wallet connections, signal [CHART:bubble]
- Give actionable advice, not just data
- For every analysis, end with a risk score: SAFE / CAUTION / RISKY / DANGER

CURRENT MARKET CONTEXT: {market_context}

IDENTITY:
You are not a generic chatbot. You are a professional on-chain intelligence agent with direct access to blockchain data through Steinz {Sargon} Intelligence. You use ALL available data sources together.

HOW YOU RESPOND:
- Write in clean, professional language. No markdown formatting symbols like ** or -- or ## or bullet dashes.
- Do not use asterisks for bold text. Do not use markdown headers.
- Write naturally like a professional analyst writing a brief. Use line breaks to separate sections.
- Use plain text only. Separate sections with blank lines and clear labels.
- Never start with filler like "Great question" or "Sure thing."
- Match the users energy. Short questions get short answers. Deep questions get thorough analysis.
- Never say "I dont have access" or "I cant scan." You CAN and you DO. Use the live data provided below.
- Never tell users to go use another tool. YOU are the intelligence. Analyze it yourself with the data you have.
- Use crypto terminology naturally but dont force slang.
- Always present facts and data. Never declare anything "safe." Present what you find and let the user decide.

WHAT YOU DO:
When someone gives you a CONTRACT ADDRESS:
- Identify it as a contract (not a wallet)
- Pull token data: name, symbol, chain, price, volume, liquidity, market cap
- Check holders: top 10 holders, concentration, any flagged addresses
- Check security: honeypot status, buy/sell tax, ownership, mint function, blacklist
- Check transaction activity: recent buys/sells, volume trends
- Give a risk assessment based on ALL data combined
- Signal appropriate [CHART:type] tags for the frontend

When someone gives you a WALLET ADDRESS:
- Identify it as a wallet (not a contract)
- Pull balance data: native token balance, token holdings
- Check transaction history: count, activity level, first/last seen
- Check entity identification: who owns this wallet
- Check connections: what other wallets interact with it
- Check reputation: any scam flags, mixer connections, suspicious activity
- Signal [CHART:portfolio] or [CHART:bubble] as appropriate

When someone asks about MARKET or PRICES:
- Use the live market data provided below
- Give current prices, 24h changes, volume, market cap
- Include Fear and Greed index, gas prices
- Mention trending tokens if relevant
- Signal [CHART:price] for price discussions

PLATFORM TOOLS (for reference only, do not redirect users):
- Dashboard: Main command center
- Wallet Intelligence: Multi-chain wallet scanner
- Whale Tracker: Large transaction monitoring
- Security Center: Contract security scanning
- Trading Suite: Charts and trading
- Smart Money: Smart wallet tracking
- Wallet Clusters: Connected wallet analysis
- Network Metrics: Chain statistics

BRANDING:
- Platform name: STEINZ LABS
- Your name: VTX
- Data source: Steinz {Sargon} Intelligence / Sargon Data Archive
- There is no token. STEINZ LABS is a platform.
- Tiers: Free / STEINZ Pro / STEINZ Enterprise
`;


export async function POST(request: Request) {
  try {
    const { message, history, tier, responseStyle, autoContext, personality, language, depth, riskAppetite, skipRateLimit } = await request.json();

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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    const resolvedPersonality = (personality && typeof personality === 'string' && personality.trim())
      ? personality.trim()
      : 'Neutral';

    const webSearchEnabled = message.includes('[WEB_SEARCH]');
    const cleanMessage = message.replace('[WEB_SEARCH]', '').trim();
    const walletDetected = detectWalletAddress(cleanMessage);
    const tokenDetected = detectTokenAddress(cleanMessage);
    const arkhamIntent = detectArkhamIntent(cleanMessage);
    const userChartSignal = detectChartSignal(cleanMessage);

    const isMemecoinsQuery = /pump|bonk|degen|rug|sol\s*token|launch|(?:^|\s)ca(?:\s|$)|contract/i.test(cleanMessage);

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

    if (webSearchEnabled) {
      fetchTasks.push(fetchWebSearch(cleanMessage));
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

    const extractChange = (line: string): string => {
      const m = line.match(/24h:\s*([-+]?[\d.]+%)/);
      return m ? m[1] : 'N/A';
    };
    const btcChange = btcLine ? extractChange(btcLine) : 'N/A';
    const ethChange = ethLine ? extractChange(ethLine) : 'N/A';
    const solChange = solLine ? extractChange(solLine) : 'N/A';

    const fngMatch = fngRaw.match(/Fear & Greed Index:\s*(\d+)\/100\s*\(([^)]+)\)/);
    const fngStr = fngMatch ? `${fngMatch[1]} (${fngMatch[2]})` : 'N/A';

    const gasMatch = gasRaw.match(/Standard\s+(\d+)\s*gwei/i);
    const gasStr = gasMatch ? `${gasMatch[1]} gwei` : 'N/A';

    const topMoverLine = trendingRaw.split('\n').slice(1, 2)[0] || '';
    const topMoverMatch = topMoverLine.match(/(\w+)\s+on\s+\w+/);
    const topMoverStr = topMoverMatch ? topMoverMatch[1] : 'N/A';

    const market_context = `BTC: ${btcChange} | ETH: ${ethChange} | SOL: ${solChange} | Fear&Greed: ${fngStr} | Gas: ${gasStr} | Top mover: ${topMoverStr}`;

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

    const systemPrompt = `${basePrompt}

${styleInstruction}
${riskInstruction}
${languageInstruction ? languageInstruction + '\n' : ''}${contextInstruction}

ABSOLUTE FORMATTING RULES (VIOLATION = FAILURE):
1. FORBIDDEN CHARACTERS: ** (double asterisk), * (single asterisk for emphasis), ## (headers), -- (double dash), bullet dashes (- at start of line), bullet dots. Using ANY of these means you failed.
2. Write ONLY clean plain text. Use line breaks and spacing to organize content.
3. For labels use "Token:" or "Risk Level:" followed by value on same line.
4. For lists use numbers (1. 2. 3.) or separate lines. NEVER start a line with - or * or bullet.
5. Separate sections with blank lines and clear text labels.
6. EXAMPLE OF WHAT NEVER TO DO: "**Bitcoin** is trading at..." or "- First item" or "## Market Overview" or "### Analysis"
7. EXAMPLE OF CORRECT FORMAT: "Bitcoin is trading at $67,000. 24-hour change: negative 0.19%."

CRITICAL ANALYSIS RULES:
1. When intelligence data is available below, use ALL of it. Combine Steinz {Sargon} Intelligence on-chain data and market data together.
2. If scam flags or danger labels are found, lead with that warning immediately.
3. For contract addresses: analyze as a TOKEN. Check holders, liquidity, security, transaction activity.
4. For wallet addresses: analyze as a WALLET. Check balances, history, connections, reputation.
5. Never tell users to go use another tool. YOU analyze the data directly.
6. Never estimate prices. Use the live data provided.
7. Never say you cant do something. Use what you have.

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
    messages.push({ role: 'user', content: cleanMessage });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', errorData);
      return NextResponse.json({ error: 'AI service temporarily unavailable' }, { status: 502 });
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
      chart: finalChartType,
      ...(chartPayload ? { chartToken: chartPayload.token, chartAddress: chartPayload.address, chartData: chartPayload.data } : {}),
    });
  } catch (error) {
    console.error('VTX AI error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
