import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import Anthropic from '@anthropic-ai/sdk';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const NAME = 'cult-generate-daily-seal';
const MODEL = 'claude-opus-4-7';

/**
 * Cron — generates the Oracle's Daily Seal for today's UTC date if missing.
 *
 * Idempotent: if a seal already exists for today's seal_date, exits in <100ms.
 * Otherwise calls Anthropic Opus with curated context (placeholder for now —
 * future revision will inject top-tickers / narrative / sentiment from the
 * existing analytics endpoints) and writes the result.
 *
 * Schedule: daily at 07:00 UTC. The seal is "broken" client-side via the
 * cinematic wax-seal reveal — see <DailySeal /> in components/vault/oracle.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const admin = getSupabaseAdmin();

  try {
    const { data: existing } = await admin
      .from('cult_daily_seals')
      .select('seal_date')
      .eq('seal_date', today)
      .maybeSingle();
    if (existing) {
      const duration = Date.now() - startedAt;
      await logCronExecution(NAME, 'success', duration, undefined, 0);
      return NextResponse.json({ ok: true, durationMs: duration, skipped: 'already_generated' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }
    const client = new Anthropic({ apiKey });

    const userPrompt = [
      `You are the Oracle of the Naka Cult. Generate today's Daily Seal — a short, cinematic morning briefing for the cult.`,
      `Date: ${today}.`,
      ``,
      `Voice: poetic but grounded; observational, not predictive; ~120 words; second-person ("the cult", "you who watch"). Avoid clichés. Avoid hype. Open with a striking single-line declaration.`,
      ``,
      `Output JSON ONLY (no markdown fences):`,
      `{ "title": "<6-12 word title>", "body": "<the briefing>" }`,
    ].join('\n');

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const block = response.content[0];
    const raw = block.type === 'text' ? block.text.trim() : '';
    if (!raw) throw new Error('empty model response');

    let parsed: { title?: string; body?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Some models wrap in ``` despite the instruction; strip and retry.
      const stripped = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      parsed = JSON.parse(stripped);
    }
    if (!parsed.title || !parsed.body) {
      throw new Error('model response missing title or body');
    }

    const { error: insErr } = await admin.from('cult_daily_seals').insert({
      seal_date: today,
      title: parsed.title.slice(0, 140),
      body: parsed.body.slice(0, 4000),
      model: MODEL,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      context_json: { generated_by: NAME, version: 1 },
    });
    if (insErr) throw insErr;

    const duration = Date.now() - startedAt;
    await logCronExecution(NAME, 'success', duration, undefined, 1);
    return NextResponse.json({
      ok: true,
      durationMs: duration,
      sealDate: today,
      tokens: { in: response.usage.input_tokens, out: response.usage.output_tokens },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, msg, 0);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
