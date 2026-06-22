import { NextRequest, NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { rateLimit, rateLimitResponse } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const MAX_BODY = 600;

interface SendPayload { body?: unknown }

/**
 * GET /api/cult/hall — recent Hall messages (oldest→newest), with author
 * identity (Mantle/username + Chosen flag). Any cult member may read.
 */
export async function GET(_req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const admin = getSupabaseAdmin();
  const { data: rows, error } = await admin
    .from('cult_hall_messages')
    .select('id, user_id, body, created_at')
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const messages = (rows ?? []).slice().reverse();
  const ids = Array.from(new Set(messages.map((m) => m.user_id)));
  const authors = new Map<string, { name: string; isChosen: boolean }>();
  if (ids.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, username, display_name, is_chosen')
      .in('id', ids);
    for (const p of profiles ?? []) {
      authors.set(p.id as string, {
        name: (p.display_name as string) || (p.username as string) || 'Cultist',
        isChosen: !!p.is_chosen,
      });
    }
  }

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      created_at: m.created_at,
      mine: m.user_id === access.userId,
      author: authors.get(m.user_id) ?? { name: 'Cultist', isChosen: false },
    })),
  });
}

/**
 * POST /api/cult/hall — send a message. Rate-limited to 5/10s per member.
 */
export async function POST(req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const rl = await rateLimit(`cult:hall:${access.userId}`, { interval: 10_000, maxRequests: 5 });
  if (!rl.success) return rateLimitResponse(rl);

  let payload: SendPayload;
  try {
    payload = (await req.json()) as SendPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (!body) return NextResponse.json({ error: 'empty' }, { status: 400 });
  if (body.length > MAX_BODY) return NextResponse.json({ error: 'too_long' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cult_hall_messages')
    .insert({ user_id: access.userId, body })
    .select('id, body, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: data }, { status: 201 });
}
