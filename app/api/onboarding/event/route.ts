import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const Body = z.object({
  event: z.enum(['viewed', 'clicked_next', 'clicked_skip', 'skip_confirmed', 'completed', 'replay_started']),
  card_index: z.number().int().min(1).max(20).optional(),
  variant: z.string().max(8).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  // Anonymous events allowed (user_id null) so analytics can still
  // see drop-off on the marketing-to-signup boundary.
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  const sb = getSupabaseAdmin();
  await sb.from('onboarding_events').insert({
    user_id: user?.id ?? null,
    event: parsed.data.event,
    card_index: parsed.data.card_index ?? null,
    variant: parsed.data.variant ?? null,
    metadata: parsed.data.metadata ?? {},
  });

  if (parsed.data.event === 'completed' && user) {
    await sb.from('profiles').update({ onboarding_completed_at: new Date().toISOString() }).eq('id', user.id);
  }
  return NextResponse.json({ ok: true });
}
