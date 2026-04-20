import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Phase 8 — community labelling.
// POST: submit a label on a cluster (requires auth).
// PATCH (body: { label_id, vote: 1|-1 }): vote on an existing label.
//   - Auto-approval: net upvotes >= 5 → status='approved' + reputation points to submitter.

export const runtime = 'nodejs';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(n: string) { return cookieStore.get(n)?.value; },
        set() {}, remove() {},
      },
    },
  );
}

const REPUTATION_PER_APPROVED = 50;
const APPROVAL_THRESHOLD = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { label?: string; description?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }

  const label = (body.label || '').trim();
  if (!label || label.length > 60) return NextResponse.json({ error: 'Label must be 1-60 chars' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.from('cluster_labels').insert({
    cluster_key: id,
    label,
    description: (body.description || '').slice(0, 500),
    submitted_by: user.id,
    upvotes: 1,
    downvotes: 0,
    status: 'pending',
    ai_generated: false,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Submitter auto-upvotes.
  await admin.from('cluster_label_votes').insert({ label_id: data.id, user_id: user.id, vote: 1 });

  return NextResponse.json({ label: data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  void id;
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { label_id?: string; vote?: number };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }
  if (!body.label_id || (body.vote !== 1 && body.vote !== -1)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Upsert the vote — one per (label_id, user_id).
  await admin.from('cluster_label_votes').upsert({
    label_id: body.label_id,
    user_id: user.id,
    vote: body.vote,
  }, { onConflict: 'label_id,user_id' });

  // Recompute totals.
  const { data: votes } = await admin
    .from('cluster_label_votes')
    .select('vote')
    .eq('label_id', body.label_id);
  const up = (votes ?? []).filter((v) => v.vote === 1).length;
  const down = (votes ?? []).filter((v) => v.vote === -1).length;
  const net = up - down;

  const { data: row } = await admin
    .from('cluster_labels')
    .update({
      upvotes: up,
      downvotes: down,
      status: net >= APPROVAL_THRESHOLD ? 'approved' : 'pending',
    })
    .eq('id', body.label_id)
    .select('submitted_by, status')
    .single();

  // Reputation bump on approval.
  if (row?.status === 'approved' && row.submitted_by) {
    const submitter = row.submitted_by;
    const rpcResult = await admin.rpc('increment_reputation', {
      p_user_id: submitter,
      p_points: REPUTATION_PER_APPROVED,
    });
    if (rpcResult.error) {
      // Fallback: direct upsert when the RPC isn't installed.
      const { data: existing } = await admin
        .from('user_reputation')
        .select('points, approved_labels')
        .eq('user_id', submitter)
        .maybeSingle();
      const points = (existing?.points ?? 0) + REPUTATION_PER_APPROVED;
      const approved = (existing?.approved_labels ?? 0) + 1;
      const tier =
        points >= 5000 ? 'Officer' :
        points >= 1500 ? 'Detective' :
        points >= 500 ? 'Analyst' :
        'Scout';
      await admin.from('user_reputation').upsert({
        user_id: submitter,
        points,
        approved_labels: approved,
        tier,
      }, { onConflict: 'user_id' });
    }
  }

  return NextResponse.json({ upvotes: up, downvotes: down, net, status: row?.status });
}
