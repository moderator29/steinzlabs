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

    const [marketData, trending, news] = await Promise.all([
      fetchLiveMarketData(),
      fetchTrendingTokens(),
      fetchCryptoNews(),
    ]);

    const liveDataSection = [
      marketData ? `LIVE MARKET DATA (updated just now):\n${marketData}` : '',
      trending || '',
      news || '',
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

CRITICAL RULE — REAL DATA ONLY:
You have access to LIVE market data below. When users ask about prices, markets, or trends, USE THIS DATA. Give exact current prices. Never say "I don't have access to real-time data" — you DO have it right here. If a specific coin isn't in the data below, say you'll need to check but give what you know.

${liveDataSection}

Rules:
- Match response length to question complexity. "What is ETH?" = 1-2 sentences. "Explain how AMMs work" = detailed breakdown.
- When discussing specific tokens or trades, add a brief risk note at the end
- Never fabricate exact price predictions
- Reference real protocols and tools by name when relevant
- Format with markdown only when it actually helps readability (lists, code, etc.)
- Be honest when you don't know something
- ALWAYS use the live data above for current prices — never estimate or use old data`;

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
        max_tokens: 2048,
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
