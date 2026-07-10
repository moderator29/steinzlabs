import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { WIRE_TOPIC_SET, WIRE_TOPIC_VALUES, WIRE_MAX_TAGS } from '@/lib/wire/topics';

/**
 * The Wire — optional AI draft helper.
 *
 * POST /api/wire/ai-draft
 *   body: { draft?: string }
 *   → { text: string, tags: string[] }
 *
 * This is a DRAFT ASSISTANT, never an auto-poster. It takes whatever the user
 * has typed so far (a rough draft, a pasted contract address / ticker, or just
 * a topic) and returns ONE clean, short, human-sounding wire the user can edit
 * before posting, plus up to a few suggested catalogue topics (which the user
 * still confirms). The generated text is only ever returned to the client — it
 * is never persisted here.
 *
 * If ANTHROPIC_API_KEY is absent or the model call fails, we answer 503 so the
 * composer can show an honest "AI assist unavailable" state; manual posting is
 * completely unaffected.
 */

const MAX_INPUT = 600;

const Body = z.object({
  draft: z.string().max(MAX_INPUT).optional().nullable(),
});

const SYSTEM = `You help someone write a single short social post for "The Wire", a crypto/tech social feed (X-style).

Rules:
- Return ONE post, at most ~280 characters. Never multiple options.
- Sound like a real human: natural, plain-spoken, specific. NOT marketing copy, NOT hype, no emojis-spam, no "🚀", no "game-changer", no exclamation stacking.
- If the user already wrote a draft, refine and tighten it while keeping THEIR voice and intent. Do not invent facts, prices, or claims they did not make.
- If they only pasted a topic, ticker, or contract address, write a clean, neutral, honest take or observation they could plausibly post — never fabricated data or fake numbers.
- You may use at most one or two #hashtags inline only if they read naturally.
- Do not add hashtags just to fill space.

Also suggest 0-3 topics from this exact list (use the lowercase value verbatim, only if clearly relevant): ${WIRE_TOPIC_VALUES.join(', ')}.

Respond with STRICT JSON only, no prose, in this shape:
{"text": "<the post>", "tags": ["<topic-value>", ...]}`;

// Distinct directions the empty-draft assistant rotates through so it never
// defaults to one go-to idea (the owner saw it always reach for "Solana
// validators"). One is picked per request from the caller id plus a clock tick.
const WIRE_ANGLES = [
  'a whale or smart-money move worth noting',
  'a market-structure or liquidity observation',
  'an AI and crypto crossover thought',
  'a memecoin or narrative observation',
  'a prediction or odds angle on where price goes next',
  'an on-chain data nugget or pattern',
  'a contrarian macro take',
  'a note on market psychology or sentiment',
  'an infrastructure or scaling angle',
  'a stablecoin or liquidity-plumbing thought',
];
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI assist unavailable' }, { status: 503 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const draft = (parsed.data.draft ?? '').trim();
  // Rotate the empty-draft angle each call so repeated taps do not keep
  // returning the same idea. Derived from the caller id plus a clock tick.
  const angle = WIRE_ANGLES[Math.abs(hashString(user.id) + Date.now()) % WIRE_ANGLES.length];
  const userPrompt = draft
    ? `The user's current draft:\n"""${draft}"""\n\nRefine it into one clean, natural wire in their voice.`
    : `The user has not written anything yet. Propose one clean, natural, non-hypey wire they could post right now, leaning into this angle: ${angle}. Make it feel fresh and specific, not a generic line, and keep it honest with no invented numbers.`;

  try {
    const client = new Anthropic({ apiKey, timeout: 30_000 });
    const response = await client.messages.create({
      // Fast, low-cost model for a short drafting task.
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const block = response.content.find((b) => b.type === 'text');
    const raw = block && block.type === 'text' ? block.text.trim() : '';
    if (!raw) return NextResponse.json({ error: 'AI assist unavailable' }, { status: 503 });

    // The model is asked for strict JSON; parse defensively and fall back to
    // treating the whole response as the post text if it wasn't clean JSON.
    let text = '';
    let tags: string[] = [];
    try {
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      const slice = jsonStart >= 0 && jsonEnd > jsonStart ? raw.slice(jsonStart, jsonEnd + 1) : raw;
      const obj = JSON.parse(slice);
      text = typeof obj.text === 'string' ? obj.text.trim() : '';
      if (Array.isArray(obj.tags)) {
        tags = obj.tags
          .map((t: unknown) => String(t).trim().toLowerCase())
          .filter((t: string) => WIRE_TOPIC_SET.has(t))
          .slice(0, WIRE_MAX_TAGS);
      }
    } catch {
      text = raw;
    }

    if (!text) text = raw;
    // Hard-cap so a runaway response can't blow past the composer limit.
    if (text.length > MAX_INPUT) text = text.slice(0, MAX_INPUT);

    return NextResponse.json({ text, tags });
  } catch {
    return NextResponse.json({ error: 'AI assist unavailable' }, { status: 503 });
  }
}
