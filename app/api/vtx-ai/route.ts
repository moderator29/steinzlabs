import { NextResponse } from 'next/server';

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
STEINZ LABS PLATFORM FEATURES (you are built into this platform):
- **Dashboard**: Main overview with portfolio summary, market trends, and quick actions
- **VTX AI** (you!): AI-powered assistant for market analysis, wallet scanning, and general questions
- **Wallet Intelligence**: Scan any ETH or SOL wallet address to see balances, holdings, transaction history, and AI assessment
- **Whale Tracker**: Real-time monitoring of large blockchain transactions (>100 ETH), auto-refreshes every 30s
- **Security Center**: Token contract scanner powered by GoPlus — checks for honeypots, rug pulls, buy/sell taxes, holder concentration
- **DNA Analyzer**: Deep analysis of token fundamentals, team, community, and on-chain metrics
- **Predictions Market**: Community-driven price predictions with proof verification (like Polymarket for crypto)
- **Portfolio Tracker**: Track your crypto holdings across multiple wallets and chains
- **Smart Money**: Follow what top traders and funds are buying/selling
- **Copy Trading / Social Trading**: Follow and copy trades from top-performing traders, create your own trading profile
- **Builder Network**: Community of verified builders — apply, get verified, and collaborate on projects
- **Builder Funding Portal**: Submit projects for community funding with milestone-based delivery and proof of completion
- **Launchpad**: Discover and participate in new token launches from verified builders
- **Project Discovery**: Find and evaluate new crypto projects with community ratings
- **Coin Discovery**: Discover trending and new coins across chains
- **Trends**: Market trend analysis and sentiment tracking
- **Wallet Clusters**: Identify connected wallets and track coordinated trading activity
- **Network Metrics**: On-chain network health metrics (TPS, active addresses, gas costs)
- **Alerts**: Set custom price alerts and whale movement notifications
- **Community**: Social features — discussion, sharing insights, and collaborative research
- **Messages**: Direct messaging between platform users
- **Swap**: Token swap interface for quick trades
- **Risk Scanner**: Assess risk levels of tokens and DeFi protocols
- **Pricing**: Platform subscription tiers and features
- **Profile**: User profile, settings, and notification preferences
- **Admin Panel**: Platform administration for managing builders, funding, and users
`;

export async function POST(request: Request) {
  try {
    const { message, history } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
    }

    const walletDetected = detectWalletAddress(message);

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

    const results = await Promise.all(fetchTasks);
    const [marketData, trending, news, fearGreed, gasPrice] = results;
    const walletData = walletDetected ? results[5] : '';

    const liveDataSection = [
      marketData ? `LIVE MARKET DATA (updated just now):\n${marketData}` : '',
      trending || '',
      news || '',
      fearGreed || '',
      gasPrice || '',
      walletData || '',
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
- When gas prices are available, mention them when relevant to trading discussions`;

    const messages = [];
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      }
    }
    messages.push({ role: 'user', content: message });

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

    return NextResponse.json({
      reply,
      model: data.model,
      usage: data.usage,
    });
  } catch (error) {
    console.error('VTX AI error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
