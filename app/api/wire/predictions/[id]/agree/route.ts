import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Agree / un-agree with a wire's inline prediction.
 *
 * POST   /api/wire/predictions/[id]/agree   idempotent add    -> { agreeCount, agreed: true }
 * DELETE /api/wire/predictions/[id]/agree   idempotent remove -> { agreeCount, agreed: false }
 *
 * The (prediction_id, user_id) pair is the PK, so a repeat POST is a no-op and a
 * repeat DELETE is harmless. agree_count on wire_predictions is maintained by a
 * DB trigger; we re-read it after the write to return the authoritative count.
 * The user id is always session-derived, never trusted from the client.
 */

async function currentCount(
  sb: ReturnType<typeof getSupabaseAdmin>,
  predictionId: string,
): Promise<number> {
  const { data } = await sb.from('wire_predictions').select('agree_count').eq('id', predictionId).maybeSingle();
  return data?.agree_count ?? 0;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid prediction id' }, { status: 400 });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = getSupabaseAdmin();

  // Ensure the prediction exists before recording agreement.
  const { data: pred } = await sb.from('wire_predictions').select('id').eq('id', id).maybeSingle();
  if (!pred) return NextResponse.json({ error: 'Prediction not found' }, { status: 404 });

  // Idempotent insert - ignore a duplicate (already agreed).
  const { error } = await sb
    .from('wire_prediction_agrees')
    .upsert({ prediction_id: id, user_id: user.id }, { onConflict: 'prediction_id,user_id', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ agreeCount: await currentCount(sb, id), agreed: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid prediction id' }, { status: 400 });
  }

  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('wire_prediction_agrees')
    .delete()
    .eq('prediction_id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ agreeCount: await currentCount(sb, id), agreed: false });
}
