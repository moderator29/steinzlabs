import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const CreateBody = z.object({
  kind: z.enum(['decree', 'whisper', 'treasury']),
  title: z.string().trim().min(6).max(140),
  body: z.string().trim().min(30).max(5000),
  durationHours: z.number().int().min(6).max(168), // 6h–7d voting window
  stakeNaka: z.number().min(0).max(1_000_000_000),
});

/**
 * GET /api/cult/proposals?status=active|passed|all
 * Returns proposals visible to the cult member, ordered by ends_at desc.
 */
export async function GET(req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const status = req.nextUrl.searchParams.get('status') ?? 'active';
  const admin = getSupabaseAdmin();
  const query = admin
    .from('cult_proposals')
    .select('id, author_id, kind, title, body, stake_naka, status, yes_weight, no_weight, abstain_weight, voter_count, ends_at, resolved_at, created_at')
    .order('ends_at', { ascending: false })
    .limit(50);
  if (status !== 'all') query.eq('status', status);
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ proposals: data ?? [] });
}

/**
 * POST /api/cult/proposals — author a new proposal.
 * Body: { kind, title, body, durationHours, stakeNaka }
 */
export async function POST(req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }
  const { kind, title, body, durationHours, stakeNaka } = parsed.data;

  const endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cult_proposals')
    .insert({
      author_id: access.userId,
      kind,
      title,
      body,
      stake_naka: stakeNaka,
      ends_at: endsAt,
    })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'insert_failed' }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
