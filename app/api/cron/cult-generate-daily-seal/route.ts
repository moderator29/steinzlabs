import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import Anthropic from '@anthropic-ai/sdk';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const NAME = 'cult-generate-daily-seal';
// claude-opus-4-7 was not a valid Anthropic model id — the single stored seal
// was produced against it. Use the current Opus id (the route intends Opus,
// and this matches the repo's other Opus callers).
const MODEL = 'claude-opus-4-8';

// Anthropic occasionally returns 529 (Overloaded). The 2026-05-12 seal failed
// on a 529 with no retry and left a gap. Retry transient overloads with
// backoff before giving up.
async function createWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
): Promise<Anthropic.Message> {
  const delays = [1000, 3000, 6000];
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const transient = status === 529 || status === 429 || (typeof status === 'number' && status >= 500);
      if (!transient || attempt >= delays.length) throw err;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
}

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

    // Phase F: a Chosen member may have authored today's seal yesterday. If a
    // pending draft exists for today's seal_date, accept the most recent one
    // and use it instead of calling Anthropic. Carries author_id in
    // context_json so the chamber can attribute it.
    const { data: draft } = await admin
      .from('cult_daily_seal_drafts')
      .select('id, title, body, author_id')
      .eq('seal_date', today)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (draft) {
      const { error: sealErr } = await admin.from('cult_daily_seals').insert({
        seal_date: today,
        title: draft.title.slice(0, 140),
        body: draft.body.slice(0, 4000),
        model: 'chosen',
        input_tokens: null,
        output_tokens: null,
        context_json: {
          generated_by: NAME,
          version: 1,
          source: 'chosen_draft',
          author_id: draft.author_id,
          draft_id: draft.id,
        },
      });
      if (sealErr) throw sealErr;

      await admin
        .from('cult_daily_seal_drafts')
        .update({ status: 'accepted', reviewed_at: new Date().toISOString() })
        .eq('id', draft.id);
      await admin
        .from('cult_daily_seal_drafts')
        .update({ status: 'superseded', reviewed_at: new Date().toISOString() })
        .eq('seal_date', today)
        .eq('status', 'pending');

      const duration = Date.now() - startedAt;
      await logCronExecution(NAME, 'success', duration, undefined, 1);
      return NextResponse.json({ ok: true, durationMs: duration, sealDate: today, source: 'chosen_draft' });
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

    const response = await createWithRetry(client, {
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
