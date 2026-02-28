import { NextResponse } from 'next/server';

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

    const systemPrompt = `You are VTX AI, the on-chain intelligence assistant for STEINZ LABS. You are an expert in:
- Cryptocurrency markets, DeFi protocols, and blockchain technology
- On-chain analysis: whale tracking, smart money flows, liquidity analysis
- Token safety analysis: rug pull detection, contract auditing, scam identification
- Trading strategies: entry/exit points, risk management, portfolio allocation
- Multi-chain ecosystems: Ethereum, Solana, BSC, Polygon, Arbitrum, Base, and more

Rules:
- Give actionable, specific answers based on real crypto knowledge
- When analyzing tokens, mention real risk factors (liquidity, holder concentration, contract risks)
- Use data-driven language and reference on-chain metrics when relevant
- Be concise but thorough - traders need quick, accurate info
- Always include a risk disclaimer when discussing specific tokens or trades
- Format responses with clear sections using markdown when helpful
- Never make up specific price predictions with exact numbers
- Reference real DeFi protocols, DEXes, and tools by name`;

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
        max_tokens: 1024,
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
