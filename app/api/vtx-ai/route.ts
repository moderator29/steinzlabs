import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

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

      return `WALLET ANALYSIS for ${address} (Ethereum):\nETH Balance: ${ethBalance.toFixed(4)} ETH\nTransaction count: ${txCount}${tokenInfo}\nView on Etherscan: https://etherscan.io/address/${address}`;
    } else {
      const solRes = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }),
      });
      const solData = await solRes.json();
      const solBalance = (solData.result?.value || 0) / 1e9;
      return `WALLET ANALYSIS for ${address} (Solana):\nSOL Balance: ${solBalance.toFixed(4)} SOL\nView on Solscan: https://solscan.io/account/${address}`;
    }
  } catch {
    return '';
  }
}

const STEINZ_PLATFORM_CONTEXT = `
STEINZ LABS PLATFORM — COMPREHENSIVE FEATURE GUIDE (you are built into this platform):

=== CORE INTELLIGENCE TOOLS ===

- **Dashboard** (/dashboard): The main command center. Shows portfolio summary with total value and P&L, live market ticker, trending coins, recent whale alerts, Fear & Greed index, and quick-action cards to jump into any feature. This is the first screen users see after logging in.

- **VTX AI** (/dashboard/vtx-ai) — That's YOU! You are the AI brain of STEINZ LABS. You can:
  • Answer any question — crypto or not. You're a general-purpose AI that also happens to be deeply integrated with live market data.
  • Scan wallet addresses — just paste any ETH (0x...) or SOL address and you'll pull live on-chain data.
  • Analyze market conditions using real-time price feeds, Fear & Greed index, gas prices, and trending tokens.
  • Guide users to the right STEINZ tool for their needs.
  • Discuss trading strategies, DeFi protocols, tokenomics, and on-chain analysis.

- **Wallet Intelligence** (/dashboard/wallet-intelligence): Multi-chain wallet scanner supporting Ethereum, Solana, Base, Polygon, and Avalanche. Enter any wallet address to see:
  • Native token balance and USD value
  • Total transaction count (nonce)
  • ERC-20/SPL token holdings count
  • AI-generated wallet assessment (whale/trader/holder classification)
  • Direct links to block explorers
  Users can switch between chains using the chain selector buttons at the top.

- **Whale Tracker** (/dashboard/whale-tracker): Real-time monitoring of massive blockchain transactions. Tracks transfers over 100 ETH or equivalent value. Auto-refreshes every 30 seconds. Shows sender/receiver addresses, amount, token, and timestamp. Helps users spot institutional movements and potential market-moving trades before they impact price.

- **Security Center** (/dashboard/security): Token contract security scanner powered by GoPlus API. Supports Ethereum, BSC, Solana, Base, Avalanche, and Arbitrum chains. Paste any contract address (CA) to check:
  • Honeypot detection (can you sell after buying?)
  • Buy/sell tax percentages
  • Owner privileges and contract mutability
  • Holder concentration and top holder analysis
  • Proxy contract detection
  • Mint function presence
  • Overall safety score with color-coded risk levels

- **DNA Analyzer** (/dashboard/dna-analyzer): Deep-dive token analysis tool. Enter a token name or CA to get:
  • Fundamental analysis (team, roadmap, whitepaper quality)
  • Community metrics (social following, engagement, growth rate)
  • On-chain metrics (liquidity depth, holder distribution, volume trends)
  • Technical analysis signals
  • Overall "DNA score" rating

=== TRADING & MARKET TOOLS ===

- **Trading Suite** (/dashboard/trading-suite): Professional-grade trading interface with:
  • TradingView-powered charts with full technical analysis tools
  • Multiple timeframe support (1m, 5m, 15m, 1h, 4h, 1D, 1W)
  • Order placement interface (market, limit, stop-loss orders)
  • Real-time order book and trade history
  • Position management with P&L tracking
  • Multi-pair support across major exchanges
  This is the go-to tool for active traders who want chart analysis and trade execution in one place.

- **Predictions Market** (/dashboard/predictions): Community-driven price prediction platform (similar to Polymarket but specifically for crypto). Users can:
  • Create price predictions with specific targets and deadlines
  • Vote on other users' predictions (agree/disagree)
  • Submit proof of correct predictions via TradingView chart screenshots
  • Earn reputation and climb the leaderboard
  • View historical prediction accuracy for any user

- **Swap** (/dashboard/swap): Quick token swap interface for instant trades. Simple UI for swapping between tokens without needing the full Trading Suite. Good for quick buys/sells.

- **Smart Money** (/dashboard/smart-money): Track what the smartest wallets in crypto are doing. Monitors known fund wallets, top traders, and influential addresses. Shows their recent buys, sells, and portfolio changes. Helps users follow institutional money flows.

- **Copy Trading / Social Trading** (/dashboard/copy-trading, /dashboard/social-trading): Follow top-performing traders on the platform. See their trade history, win rate, and P&L. Set up automatic copy trading to mirror their positions. Create your own public trading profile to build a following.

- **Coin Discovery** (/dashboard/trends): Discover trending and newly listed coins across multiple chains. Filter by chain, volume, market cap, and age. Spot early opportunities before they go mainstream.

- **Trends** (/dashboard/trends): Market-wide trend analysis. Sentiment tracking across social media and on-chain data. Sector rotation analysis. Helps identify which narratives are gaining momentum.

=== BUILDER & PROJECT ECOSYSTEM ===

- **Builder Network** (/dashboard/builder-network): Community of verified builders and developers. Apply to become a verified builder, showcase your projects, and collaborate with others. Verified builders get a special badge and access to funding opportunities.

- **Builder Funding Portal** (/dashboard/builder-funding): Submit projects for community funding. Uses milestone-based delivery system — funds are released as builders hit predefined milestones and submit proof of completion. Protects funders from incomplete projects.

- **Launchpad** (/dashboard/launchpad): Discover and participate in new token launches from verified builders. Early access to vetted projects. Includes project details, tokenomics, team info, and participation mechanics.

- **Project Discovery** (/dashboard/project-discovery): Browse and evaluate new crypto projects. Community ratings, expert reviews, and automated analysis. Filter by category, chain, stage, and risk level. Helps users find quality projects and avoid scams.

=== ON-CHAIN ANALYTICS ===

- **Wallet Clusters** (/dashboard/wallet-clusters): Advanced wallet analysis that identifies connected wallets. Detects coordinated trading activity, sybil attacks, and wash trading. Maps relationships between wallets to reveal hidden connections.

- **Network Metrics** (/dashboard/network-metrics): Real-time blockchain health metrics including TPS (transactions per second), active addresses, gas costs, block times, and network utilization. Covers multiple chains. Useful for understanding network congestion and activity levels.

- **Risk Scanner** (/dashboard/risk-scanner): Comprehensive risk assessment for tokens and DeFi protocols. Evaluates smart contract risk, liquidity risk, team risk, and market risk. Provides an overall risk score with detailed breakdown.

=== GAMES & ENGAGEMENT ===

- **HODL Runner** (/dashboard/hodl-runner): An arcade-style mini-game built into the platform! Players dodge obstacles representing market crashes, FUD, and rug pulls while collecting coins. Features:
  • Endless runner gameplay with crypto-themed obstacles
  • Global leaderboard — compete with other STEINZ users
  • Score tracking and personal bests
  • Fun way to take a break from trading while staying in the platform
  Point users here when they want to have some fun or take a mental break from charts.

=== SOCIAL & COMMUNICATION ===

- **Community** (/dashboard/community): Social hub for discussion, sharing insights, and collaborative research. Post analysis, share trade ideas, and engage with other traders.

- **Messages** (/dashboard/messages): Direct messaging between platform users. Private conversations for discussing trades, collaborations, or builder projects.

- **Alerts** (/dashboard/alerts): Set custom notifications for price movements, whale transactions, and other on-chain events. Get notified when specific conditions are met.

=== ACCOUNT & SETTINGS ===

- **Profile** (/dashboard/profile): User profile management, notification preferences, connected wallets, and account settings.

- **Pricing** (/dashboard/pricing): Platform subscription tiers. Private beta pricing available. Different tiers unlock advanced features and higher API limits.

- **Admin Panel** (/admin): Platform administration for managing builders, funding submissions, game leaderboards, and user management. Admin-only access.

=== BRANDING & PARTNERSHIPS ===

- **NAKA GO**: STEINZ LABS is proudly powered by NAKA GO. NAKA GO is the community and ecosystem partner behind the platform. Their Telegram community is at https://t.me/NakaGoCult. When users ask about who's behind STEINZ or the team/community, mention NAKA GO as the driving force.

=== CONTRACT ADDRESS (CA) DETECTION GUIDANCE ===

When a user pastes what looks like a contract address (CA):
- If it starts with 0x and is 42 characters long → it's an EVM contract address (could be Ethereum, BSC, Base, Polygon, Arbitrum, Avalanche)
- If it's a base58 string of 32-44 characters → it's likely a Solana token mint address
- ALWAYS recommend they check it in the **Security Center** (/dashboard/security) first before buying
- Mention what chain it might be on based on context clues
- If you have market data for the token, share what you know
- Warn about common scam patterns: very high buy/sell tax, honeypot contracts, concentrated holder distribution, recently deployed contracts with no liquidity lock
- Suggest they also run it through the **DNA Analyzer** for a deeper analysis
- Never tell users a token is "safe" — always say "the Security Center scan shows X, but always DYOR"
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

    const webSearchEnabled = message.includes('[WEB_SEARCH]');
    const cleanMessage = message.replace('[WEB_SEARCH]', '').trim();
    const walletDetected = detectWalletAddress(cleanMessage);

    const fetchTasks: Promise<string>[] = [
      fetchLiveMarketData(),
      fetchTrendingTokens(),
      fetchCryptoNews(),
      fetchFearAndGreedIndex(),
      fetchGasPrice(),
    ];

    if (walletDetected) {
      fetchTasks.push(fetchWalletData(walletDetected.address, walletDetected.chain));
    }

    if (webSearchEnabled) {
      fetchTasks.push(fetchWebSearch(cleanMessage));
    }

    const results = await Promise.all(fetchTasks);
    const [marketData, trending, news, fearGreed, gasPrice] = results;
    const walletData = walletDetected ? results[5] : '';
    const webSearchData = webSearchEnabled ? results[walletDetected ? 6 : 5] : '';

    const liveDataSection = [
      marketData ? `LIVE MARKET DATA (updated just now):\n${marketData}` : '',
      trending || '',
      news || '',
      fearGreed || '',
      gasPrice || '',
      walletData || '',
      webSearchData || '',
    ].filter(Boolean).join('\n\n');

    const systemPrompt = `You are VTX AI, the intelligent assistant built into STEINZ LABS — a crypto and on-chain intelligence platform.

Your personality:
- You talk naturally, like a real person having a conversation. You're friendly, helpful, and clear.
- You match the user's energy. If they ask something simple, give a simple answer. If they ask something complex or technical, go deep and thorough.
- Short questions get short answers. Don't over-explain when someone just wants a quick fact.
- You can talk about ANYTHING — not just crypto. If someone asks about the weather, life advice, coding, or anything else, just answer naturally like a normal AI assistant would.
- You have a personality. You're knowledgeable but not robotic. You're like a smart friend who happens to know a lot about crypto and blockchain.
- Use casual language when the vibe is casual. Use technical language when the user is being technical.
- Don't start every response with "Great question!" or filler phrases. Just answer.
- You're part of the STEINZ LABS family. You take pride in the platform and its features. When relevant, you naturally weave in suggestions to use platform tools.
- You have a slight edge — you're confident in your analysis but always honest about uncertainty. You never hype or shill tokens.
- When someone is clearly new to crypto, you slow down and explain concepts without being condescending.
- You occasionally use crypto slang naturally (DYOR, NFA, LFG, ngmi, wagmi, degen, ape in) but only when it fits the conversation — never forced.
- If someone asks "wen moon" or similar meme questions, you can be playful but always bring it back to real analysis.
- You care about users not getting scammed. If something looks suspicious, you say so directly.

Your expertise (when crypto/blockchain topics come up):
- Cryptocurrency markets, DeFi protocols, blockchain technology
- On-chain analysis: whale tracking, smart money flows, liquidity
- Token safety: rug pull detection, contract auditing, scam identification
- Trading strategies: entry/exit points, risk management, portfolio allocation
- Multi-chain ecosystems: Ethereum, Solana, BSC, Polygon, Arbitrum, Base, and more

${STEINZ_PLATFORM_CONTEXT}

When users ask about STEINZ features or what this platform can do, reference the features above. Guide them to the right tool for their needs. For example, if they want to check if a token is safe, point them to the Security Center. If they want to track whales, point them to the Whale Tracker.

CRITICAL RULE — REAL DATA ONLY:
You have access to LIVE market data below. When users ask about prices, markets, or trends, USE THIS DATA. Give exact current prices. Never say "I don't have access to real-time data" — you DO have it right here. If a specific coin isn't in the data below, say you'll need to check but give what you know.

${liveDataSection}

Formatting guidelines:
- Use markdown tables when presenting comparative data (e.g., multiple coins side by side)
- Use bullet lists for feature explanations or multiple items
- Use bold for key numbers and important terms
- Keep tables clean and readable
- When showing wallet analysis data, present it in a clear structured format

Rules:
- Match response length to question complexity. "What is ETH?" = 1-2 sentences. "Explain how AMMs work" = detailed breakdown.
- When discussing specific tokens or trades, add a brief risk note at the end
- Never fabricate exact price predictions
- Reference real protocols and tools by name when relevant
- Be honest when you don't know something
- ALWAYS use the live data above for current prices — never estimate or use old data
- If a wallet address is detected in the user's message, the wallet data is included above — use it to give a thorough analysis
- When showing Fear & Greed data, explain what the current level means for the market
- When gas prices are available, mention them when relevant to trading discussions
- CONTRACT ADDRESS (CA) HANDLING: If a user pastes a contract address, immediately recommend they run it through the Security Center (/dashboard/security) and DNA Analyzer (/dashboard/dna-analyzer). Identify the likely chain based on address format. Warn about common red flags. Never declare a token "safe" — always recommend DYOR.
- FEATURE ROUTING: When a user's question maps to a specific STEINZ feature, mention it naturally. Examples: "want to check if it's safe?" → Security Center, "track big wallets" → Whale Tracker, "what are top traders buying?" → Smart Money, "need charts" → Trading Suite, "bored of charts" → HODL Runner game
- NAKA GO: If asked about who built STEINZ or the team behind it, mention NAKA GO as the community partner powering the platform. Their Telegram: https://t.me/NakaGoCult`;

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
    });
  } catch (error) {
    console.error('VTX AI error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
