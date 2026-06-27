import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

/**
 * POST /api/context-feed/pulse
 * Body: { events: { title, tokenSymbol?, chain?, tokenPriceChange24h?, tokenVolume24h?, sentiment? }[] }
 *
 * Returns an AI "Market Pulse" — a tight 2–3 sentence read on what the feed is
 * showing right now (what's hot, where the volume is, the overall tone). Uses
 * the platform's existing Anthropic key. Result is cached in-memory for 5 min
 * so we summarise the market at most ~12×/hour regardless of how many clients
 * mount the card. Real data only — if there are no events we say so.
 */

interface PulseEvent {
  title?: string;
  tokenSymbol?: string;
  chain?: string;
  tokenPriceChange24h?: number;
  tokenVolume24h?: number;
  sentiment?: string;
}

const CACHE_TTL = 5 * 60 * 1000;
let cache: { pulse: string; tone: string; ts: number } | null = null;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });

function fmtUsd(n?: number): string {
  if (!n || n <= 0) return '';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ pulse: cache.pulse, tone: cache.tone, cached: true });
  }

  let events: PulseEvent[] = [];
  try {
    const body = await req.json();
    events = Array.isArray(body?.events) ? body.events.slice(0, 24) : [];
  } catch {
    events = [];
  }
  if (events.length === 0) {
    return NextResponse.json({ pulse: 'No live market signals right now — check back shortly.', tone: 'neutral' });
  }

  // Compact the events into a token-efficient list for the model.
  const lines = events.map((e) => {
    const parts: string[] = [];
    if (e.tokenSymbol) parts.push(`$${e.tokenSymbol}`);
    if (e.chain) parts.push(e.chain);
    if (typeof e.tokenPriceChange24h === 'number' && e.tokenPriceChange24h !== 0) parts.push(`${e.tokenPriceChange24h > 0 ? '+' : ''}${e.tokenPriceChange24h.toFixed(1)}%`);
    const vol = fmtUsd(e.tokenVolume24h);
    if (vol) parts.push(`vol ${vol}`);
    if (e.sentiment) parts.push(e.sentiment.toLowerCase());
    return `- ${e.title ?? parts.join(' ')}${parts.length ? ` (${parts.join(', ')})` : ''}`;
  }).join('\n');

  try {
    const resp = await (client.messages.create as Function)({
      model: 'claude-sonnet-4-6',
      max_tokens: 220,
      system: 'You are the market intelligence layer of a crypto trading platform. Given a live feed of on-chain events, write a punchy 2-3 sentence "Market Pulse" — what is hot right now, where the volume/momentum is concentrated (chains, sectors, notable tokens), and the overall tone. Be specific and grounded ONLY in the data given; never invent tokens or numbers. No preamble, no disclaimers, no markdown. End with the single word TONE: followed by one of bullish/bearish/mixed.',
      messages: [{ role: 'user', content: `Live feed (newest first):\n${lines}` }],
    });
    const text = (resp?.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('')
      .trim();
    // Split off the TONE marker.
    const m = text.match(/TONE:\s*(bullish|bearish|mixed)/i);
    const tone = (m?.[1] ?? 'mixed').toLowerCase();
    const pulse = text.replace(/TONE:\s*(bullish|bearish|mixed)/i, '').trim();
    cache = { pulse, tone, ts: Date.now() };
    return NextResponse.json({ pulse, tone });
  } catch {
    return NextResponse.json({ error: 'pulse_failed' }, { status: 502 });
  }
}
