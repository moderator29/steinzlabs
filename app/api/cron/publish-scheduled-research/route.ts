/**
 * Bug §6.2: scheduled research publisher. Research posts with a future
 * scheduled_at should auto-flip to status='published' when that time arrives.
 *
 * Intentionally minimal — one UPDATE, no external calls. Runs every 5
 * minutes (see vercel.json). If there are no due posts the query hits an
 * indexed partial scan and returns in <30ms, so we don't burn function-
 * invocation cost doing nothing. If there ARE due posts, we publish them
 * all in a single round-trip.
 */
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyCron, cronResponse, logCronExecution } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok && auth.response) return auth.response;

  const startedAt = Date.now();
  const supabase = getSupabaseAdmin();

  try {
    const nowIso = new Date().toISOString();
    // status='draft' + scheduled_at <= now → flip to published.
    const { data, error } = await supabase
      .from('research_posts')
      .update({ status: 'published', published_at: nowIso })
      .eq('status', 'draft')
      .not('scheduled_at', 'is', null)
      .lte('scheduled_at', nowIso)
      .select('id');

    if (error) {
      await logCronExecution('publish-scheduled-research', 'failed', Date.now() - startedAt, error.message, 0);
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    const published = data?.length ?? 0;
    await logCronExecution('publish-scheduled-research', 'success', Date.now() - startedAt, undefined, published);
    return cronResponse('publish-scheduled-research', startedAt, { published });
  } catch (err: any) {
    await logCronExecution('publish-scheduled-research', 'failed', Date.now() - startedAt, err?.message || 'unknown', 0);
    return Response.json({ ok: false, error: err?.message || 'unknown' }, { status: 500 });
  }
}
