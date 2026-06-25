import { NextRequest, NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface DraftPayload {
  title?: unknown;
  body?: unknown;
  seal_date?: unknown;
}

function nextUtcDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * GET — list the draft surface for the current Chosen.
 *   • `next` = the most recent pending draft for tomorrow's seal (any author)
 *   • `mine` = up to 10 most recent drafts authored by the caller
 *
 * Any cult member can read; only Chosen members can POST.
 */
export async function GET(_req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const target = nextUtcDate();

  const [{ data: nextDraft }, { data: mine }] = await Promise.all([
    admin
      .from('cult_daily_seal_drafts')
      .select('id, seal_date, title, body, status, author_id, created_at')
      .eq('seal_date', target)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    access.userId
      ? admin
          .from('cult_daily_seal_drafts')
          .select('id, seal_date, title, body, status, created_at')
          .eq('author_id', access.userId)
          .order('created_at', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] as Array<unknown> }),
  ]);

  return NextResponse.json({
    targetDate: target,
    next: nextDraft ?? null,
    mine: mine ?? [],
  });
}

/**
 * POST — submit a draft for tomorrow's Daily Seal.
 *
 * Chosen-only. Body: { title, body, seal_date? }. seal_date defaults to
 * tomorrow UTC; explicit dates must still be >= today + 1 day to prevent
 * overwriting an already-generated seal.
 */
export async function POST(req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let payload: DraftPayload;
  try {
    payload = (await req.json()) as DraftPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (title.length < 6 || title.length > 140) {
    return NextResponse.json({ error: 'title_length', detail: '6..140' }, { status: 400 });
  }
  if (body.length < 60 || body.length > 4000) {
    return NextResponse.json({ error: 'body_length', detail: '60..4000' }, { status: 400 });
  }

  const sealDate =
    typeof payload.seal_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.seal_date)
      ? payload.seal_date
      : nextUtcDate();

  // Refuse past/present dates — a seal already generated for that day must
  // not be overwritten by a late draft.
  const today = new Date().toISOString().slice(0, 10);
  if (sealDate <= today) {
    return NextResponse.json({ error: 'seal_date_must_be_future' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cult_daily_seal_drafts')
    .insert({
      seal_date: sealDate,
      author_id: access.userId,
      title,
      body,
    })
    .select('id, seal_date, title, body, status, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ draft: data }, { status: 201 });
}
