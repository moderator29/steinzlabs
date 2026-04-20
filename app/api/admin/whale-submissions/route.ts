/**
 * Bug §2.14: admin list + review for user-submitted whales.
 *
 * GET  — paginated list of whale_submissions, newest first, status-filterable.
 * POST — approve or reject one submission. On approve: row gets inserted
 *        into `whales` with entity_type='trader' and is_active=true, the
 *        submission is marked status='approved' with reviewer_id/at/notes.
 *        On reject: submission gets status='rejected' + notes; no whale
 *        insert.
 *
 * Auth: admin-only (ADMIN_MIGRATION_SECRET header or profiles.role='admin').
 *
 * The existing submit endpoint writes to the same table with status='pending'
 * — this route is the other half of that loop.
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorized(req: NextRequest): Promise<{ ok: boolean; userId?: string }> {
  const headerSecret = req.headers.get('x-migration-secret');
  if (headerSecret && process.env.ADMIN_MIGRATION_SECRET && headerSecret === process.env.ADMIN_MIGRATION_SECRET) {
    return { ok: true };
  }
  const user = await getAuthenticatedUser(req);
  if (!user) return { ok: false };
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (data?.role !== 'admin') return { ok: false };
  return { ok: true, userId: user.id };
}

export async function GET(req: NextRequest) {
  const auth = await authorized(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = req.nextUrl;
  const status = url.searchParams.get('status') || 'pending';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('whale_submissions')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Counts for each status (useful for the admin sidebar badge)
  const { count: pending } = await supabase
    .from('whale_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { count: approved } = await supabase
    .from('whale_submissions').select('*', { count: 'exact', head: true }).eq('status', 'approved');
  const { count: rejected } = await supabase
    .from('whale_submissions').select('*', { count: 'exact', head: true }).eq('status', 'rejected');

  return NextResponse.json({
    submissions: data ?? [],
    counts: { pending: pending ?? 0, approved: approved ?? 0, rejected: rejected ?? 0 },
  });
}

export async function POST(req: NextRequest) {
  const auth = await authorized(req);
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { id?: string; action?: 'approve' | 'reject'; notes?: string } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const { id, action, notes } = body;
  if (!id || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'id + action (approve|reject) required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: submission, error: fetchErr } = await supabase
    .from('whale_submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }
  if (submission.status !== 'pending') {
    return NextResponse.json({ error: `Already ${submission.status}` }, { status: 409 });
  }

  if (action === 'reject') {
    const { error } = await supabase
      .from('whale_submissions')
      .update({
        status: 'rejected',
        reviewer_id: auth.userId ?? null,
        reviewed_at: new Date().toISOString(),
        reviewer_notes: notes ?? null,
      })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'rejected', id });
  }

  // action === 'approve' — insert into whales, then flip submission status.
  // If the address is already in whales, just reactivate rather than insert
  // (duplicate address+chain would FK-conflict).
  const { data: existing } = await supabase
    .from('whales')
    .select('id')
    .eq('address', submission.address)
    .eq('chain', submission.chain)
    .maybeSingle();

  let whaleId: string;
  if (existing?.id) {
    const { error } = await supabase
      .from('whales')
      .update({
        is_active: true,
        label: submission.proposed_label || null,
        entity_type: submission.proposed_entity_type || 'trader',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    if (error) return NextResponse.json({ error: `reactivate failed: ${error.message}` }, { status: 500 });
    whaleId = existing.id;
  } else {
    const { data: inserted, error } = await supabase
      .from('whales')
      .insert({
        address: submission.address,
        chain: submission.chain,
        label: submission.proposed_label || `User-submitted ${submission.chain} whale`,
        entity_type: submission.proposed_entity_type || 'trader',
        whale_score: 60, // conservative baseline; PnL backfill cron will recompute
        is_active: true,
        verified: false,
        first_seen_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error || !inserted) return NextResponse.json({ error: `insert failed: ${error?.message}` }, { status: 500 });
    whaleId = inserted.id;
  }

  const { error: updErr } = await supabase
    .from('whale_submissions')
    .update({
      status: 'approved',
      reviewer_id: auth.userId ?? null,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: notes ?? null,
    })
    .eq('id', id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, action: 'approved', whaleId, submissionId: id });
}
