import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUPPORT_SYSTEM_PROMPT = `You are the Naka Labs AI Customer Support assistant. You help users with questions about the platform. You are friendly, professional, and helpful. You respond in plain clean text with no markdown formatting, no dashes, no asterisks, no bold markers. Use numbered lists for steps.

PLATFORM KNOWLEDGE:

Naka Labs is a multi-chain crypto intelligence and trading platform.

FEATURES:
Wallet Intelligence: Analyze any wallet across Ethereum, Solana, Base, Arbitrum, Polygon, BNB, Avalanche. Shows holdings, transactions, AI summary.
DNA Analyzer: Deep trading analysis with win rate, PnL, risk score, portfolio grade, archetype.
VTX Agent: AI crypto assistant with real-time prices, market analysis, wallet analysis, and swap execution when enabled.
Whale Tracker: Monitor large wallet movements. Follow whales, get notifications.
Bubble Map: Visualize token holder distribution.
Market Trading: Real-time charts via TradingView, buy/sell via 0x Protocol and Jupiter.
Swap: Multi-chain token swaps. 0.4 percent platform fee.
Sniper Bot: Automated new token detection and trading. Max plan only.
Security Tools: Contract Analyzer, Security Center, Domain Shield, Signature Insight, Approval Manager, Risk Scanner.

WALLET:
Non-custodial. Users create wallet or import via seed phrase. Keys encrypted with AES-256-GCM. Platform cannot access private keys. Seed phrase shown once during creation, never stored.

PRICING:
Free: 25 VTX messages per day, basic intelligence, 3 price alerts
Mini (5 dollars per month): 100 VTX messages per day, full intelligence, 10 alerts
Pro (9 dollars per month): Unlimited VTX, all features, 50 alerts, gasless swaps, copy trading
Max (15 dollars per month): Everything plus Sniper Bot, priority support

Always be helpful. If you do not know something, say so. Never make up information.`;

function sanitizeResponse(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/—/g, '-')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n\n\n+/g, '\n\n');
}

export async function POST(request: NextRequest) {
  try {
    const { messages, conversationId } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages' }, { status: 400 });
    }

    const anthropicMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SUPPORT_SYSTEM_PROMPT,
      messages: anthropicMessages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const sanitized = sanitizeResponse(event.delta.text);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: sanitized })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          console.error('[Support API] Stream error:', err instanceof Error ? err.message : err);
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    console.error('[Support API] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Support service unavailable' }, { status: 500 });
  }
}
