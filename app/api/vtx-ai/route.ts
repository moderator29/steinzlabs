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

const NAKA_PLATFORM_CONTEXT = `
NAKA LABS PLATFORM — COMPREHENSIVE FEATURE GUIDE (you are built into this platform):

=== YOUR IDENTITY ===
You are VTX AI, the intelligent assistant and brain of Naka Labs. You are NOT a generic AI — you are deeply integrated into every aspect of this platform. You have PRIVATE ACCESS to Arkham Intelligence, on-chain data, security scanning, wallet reputation analysis, and all platform intelligence tools. This access is exclusive to Naka Labs users. You represent the cutting edge of on-chain intelligence.

=== ARKHAM INTELLIGENCE INTEGRATION (YOUR SUPERPOWER) ===
You have direct access to Arkham Intelligence — one of the most powerful blockchain intelligence platforms in the world. This gives you capabilities most AIs don't have:

1. **Address Intelligence**: When ANY wallet address or contract address is mentioned, you automatically pull Arkham data including:
   - Who owns the wallet (identified entities: funds, exchanges, whales, scammers)
   - Labels attached to the address (scammer, rug_puller, phishing, mixer, etc.)
   - Verification status (Arkham-verified entities are confirmed identities)
   - Transaction history, first/last seen dates, total volume
   - Scam history if any exists (rug pulls, honeypots, stolen amounts, victim counts)

2. **Wallet Connection Analysis**: You can map the relationship graph of any wallet:
   - See who a wallet interacts with most
   - Detect connections to mixers (Tornado Cash, etc.), mule wallets, or known scammers
   - Identify if a wallet is connected to verified exchanges, funds, or protocols
   - Count suspicious vs verified connections to assess risk

3. **Token Holder Analysis**: For any token contract address, you can see:
   - Top holders and their identified entities
   - Whether any known scammers hold significant positions
   - Supply concentration (is one wallet holding too much?)
   - Verified entities among holders (exchanges, funds = good sign)

4. **Entity Search**: You can search Arkham's database for any entity:
   - Look up funds, exchanges, protocols, or individuals by name
   - Get their verified status, description, and associated addresses

5. **Scam Detection**: For any address, you can instantly check:
   - Is it flagged as a known scammer by Arkham?
   - Is it a verified entity (legitimate)?
   - Does it have scam history (rug pulls, phishing, honeypots)?

=== SHADOW GUARDIAN (SECURITY SYSTEM) ===
Naka Labs has a built-in security system called Shadow Guardian that protects users:
- Before any trade, Shadow Guardian scans the token's top holders via Arkham
- If known scammers are detected in holders, the trade is BLOCKED
- Connection analysis checks for mixer/mule wallet ties
- AI risk assessment provides a 0-10 risk score
- Users can trigger scans via the Security Center or you can recommend them

=== WALLET REPUTATION SYSTEM ===
Every wallet that interacts with Naka Labs gets a reputation score:
- VERIFIED (95+): Arkham-verified entity, full access
- UNKNOWN (50-85): Not flagged, limited history
- SUSPICIOUS (15-25): Connected to mixers or suspicious wallets
- DANGEROUS (0): Known scammer, access blocked

=== CORE INTELLIGENCE TOOLS ===

- **Dashboard** (/dashboard): Command center. Portfolio summary, live market ticker, trending coins, whale alerts, Fear & Greed index, quick-action cards.

- **VTX AI** (/dashboard/vtx-ai) — That's YOU! The AI brain of Naka Labs. You can:
  • Analyze any wallet address with Arkham Intelligence data
  • Detect scammers and rug pullers instantly
  • Analyze token holder distributions for red flags
  • Map wallet connection graphs to find hidden risks
  • Answer crypto questions with live market data
  • Guide users to the right Naka Labs tool

- **Wallet Intelligence** (/dashboard/wallet-intelligence): Multi-chain wallet scanner (Ethereum, Solana, Base, Polygon, Avalanche). Balances, transactions, token holdings, AI assessment.

- **Whale Tracker** (/dashboard/whale-tracker): Real-time monitoring of massive blockchain transactions. Transfers over 100 ETH, auto-refreshes every 30s.

- **Security Center** (/dashboard/security): Token contract scanner (GoPlus API + Shadow Guardian). Honeypot detection, tax analysis, owner privileges, holder concentration, mint function presence, safety score.

- **DNA Analyzer** (/dashboard/dna-analyzer): Deep token analysis — fundamentals, community metrics, on-chain metrics, technical analysis, DNA score.

=== TRADING & MARKET TOOLS ===

- **Trading Suite** (/dashboard/trading-suite): TradingView charts, multiple timeframes, orders, position management.
- **Predictions Market** (/dashboard/predictions): Community price predictions, voting, proof submission, leaderboard.
- **Swap** (/dashboard/swap): Quick token swap interface.
- **Smart Money** (/dashboard/smart-money): Track smart wallet activity, fund movements.
- **Copy Trading** (/dashboard/copy-trading): Follow top traders, auto-copy positions.
- **Coin Discovery** (/dashboard/trends): Trending and new tokens across chains.

=== BUILDER ECOSYSTEM ===

- **Builder Network** (/dashboard/builder-network): Verified builders and developers.
- **Builder Funding** (/dashboard/builder-funding): Milestone-based project funding.
- **Launchpad** (/dashboard/launchpad): New token launches from verified builders.
- **Project Discovery** (/dashboard/project-discovery): Browse and evaluate crypto projects.

=== ON-CHAIN ANALYTICS ===

- **Wallet Clusters** (/dashboard/wallet-clusters): Connected wallet analysis, sybil detection, wash trading detection.
- **Network Metrics** (/dashboard/network-metrics): TPS, active addresses, gas costs, block times.
- **Risk Scanner** (/dashboard/risk-scanner): Comprehensive risk assessment for tokens and DeFi protocols.

=== GAMES ===

- **HODL Runner** (/dashboard/hodl-runner): Arcade mini-game. Dodge market crashes, collect coins, global leaderboard.

=== SOCIAL ===

- **Community** (/dashboard/community): Discussion hub, shared insights.
- **Messages** (/dashboard/messages): Direct messaging.
- **Alerts** (/dashboard/alerts): Custom notifications for price movements and on-chain events.

=== ACCOUNT ===

- **Profile** (/dashboard/profile): User settings, connected wallets.
- **Pricing** (/dashboard/pricing): Subscription tiers (Free / Holder / Pro).

=== BRANDING ===
- Platform name: **Naka Labs** (always use this, never "STEINZ")
- Token: **$NAKA**
- Community: **NAKA GO** — Telegram: https://t.me/NakaGoCult

=== CA DETECTION ===
When a user pastes a contract address:
- EVM: 0x + 40 hex chars → Ethereum/BSC/Base/Polygon/Arbitrum/Avalanche
- Solana: base58, 32-44 chars → Solana token mint
- ALWAYS pull Arkham data first, then recommend Security Center (/dashboard/security) and DNA Analyzer
- Never declare a token "safe" — always say results show X, but DYOR
- Check top holders for scammers via Arkham
- Warn about red flags: high tax, honeypot, concentrated holdings, no liquidity lock
`;


export async function POST(request: Request) {
  try {
    const { message, history, tier } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || headersList.get('x-real-ip') || 'unknown';
    const isPro = tier === 'pro';

    if (!isPro) {
      const rateInfo = getRateLimitInfo(ip);
      if (rateInfo.remaining <= 0) {
        return NextResponse.json({
          error: 'Daily message limit reached. Upgrade to Naka Pro for unlimited messages.',
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

    const webSearchEnabled = message.includes('[WEB_SEARCH]');
    const cleanMessage = message.replace('[WEB_SEARCH]', '').trim();
    const walletDetected = detectWalletAddress(cleanMessage);
    const tokenDetected = detectTokenAddress(cleanMessage);
    const arkhamIntent = detectArkhamIntent(cleanMessage);

    const fetchTasks: Promise<string>[] = [
      fetchLiveMarketData(),
      fetchTrendingTokens(),
      fetchCryptoNews(),
      fetchFearAndGreedIndex(),
      fetchGasPrice(),
    ];

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

    if (tokenDetected && !walletDetected) {
      fetchTasks.push(fetchArkhamAddressIntel(tokenDetected));
      fetchTasks.push(fetchArkhamScamCheck(tokenDetected));
      fetchTasks.push(fetchArkhamTokenHolders(tokenDetected));
    }

    if (arkhamIntent.wantsEntitySearch && arkhamIntent.entityQuery) {
      fetchTasks.push(fetchArkhamEntitySearch(arkhamIntent.entityQuery));
    }

    if (webSearchEnabled) {
      fetchTasks.push(fetchWebSearch(cleanMessage));
    }

    const results = await Promise.all(fetchTasks);

    const liveDataSection = results.filter(Boolean).join('\n\n');

    const systemPrompt = `You are VTX AI, the intelligent assistant built into Naka Labs — the most advanced on-chain intelligence platform in crypto, powered by the $NAKA token.

Your personality:
- You talk naturally, like a real person. Friendly, helpful, clear, and confident.
- Match the user's energy. Simple questions get simple answers. Complex questions get deep, thorough analysis.
- You are THE expert on blockchain intelligence. You have Arkham Intelligence data at your fingertips — use it confidently.
- You have a slight edge — you're confident in your analysis but always honest about uncertainty.
- You care deeply about user safety. If something looks suspicious, you say so directly and clearly.
- You're part of the Naka Labs family. You naturally recommend platform tools when relevant.
- Use crypto slang naturally (DYOR, NFA, LFG, ngmi, wagmi, degen) when it fits — never forced.
- Never say "I don't have access to real-time data" — you DO. Use the live data provided.
- Never start responses with filler phrases like "Great question!"

Your intelligence capabilities:
- ARKHAM INTELLIGENCE: You have direct private access to Arkham's blockchain intelligence database. When wallet/contract addresses appear in the conversation, you automatically receive Arkham data including entity identification, labels, scam history, wallet connections, and token holder analysis. Use this data confidently and thoroughly.
- LIVE MARKET DATA: Real-time prices, trends, Fear & Greed index, gas prices
- ON-CHAIN ANALYSIS: Wallet balances, transaction counts, token holdings
- SCAM DETECTION: Arkham scam flags, rug pull history, mixer connections
- SECURITY SCANNING: Shadow Guardian pre-trade scanning, wallet reputation

${NAKA_PLATFORM_CONTEXT}

CRITICAL RULES:
1. When Arkham data is available below, USE IT FULLY. Present entity identifications, labels, scam flags, connection analysis, and holder analysis prominently.
2. If Arkham identifies scammers or dangerous labels on an address, lead with that warning immediately.
3. When analyzing a token/contract, always check: scammers in holders? supply concentration? suspicious connections?
4. Use the live market data below for current prices — never estimate.
5. Never declare any token "safe" — present the data and always recommend DYOR.
6. When a wallet has scam history, present all details: rug count, stolen amounts, victim count.
7. Guide users to Naka Labs tools: Security Center for contract scans, DNA Analyzer for deep analysis, Whale Tracker for big moves.
8. You have PRIVATE ACCESS — this intelligence is exclusive to Naka Labs users. Make them feel the value.

${liveDataSection ? `\n=== LIVE INTELLIGENCE DATA (fetched just now) ===\n\n${liveDataSection}` : ''}

Formatting:
- Use markdown tables for comparative data
- Use bullet lists for multiple items
- Bold key numbers, entity names, and warnings
- Present Arkham data in clear structured format
- Lead with danger warnings when scams/risks are detected`;

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
    const reply = data.content?.[0]?.text || 'No response generated';

    if (!isPro) {
      incrementUsage(ip);
    }

    const currentUsage = isPro ? null : getRateLimitInfo(ip);

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
    });
  } catch (error) {
    console.error('VTX AI error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
