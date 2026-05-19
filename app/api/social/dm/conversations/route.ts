import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { canUserDM, canonicalizePair } from '@/lib/social/permissions';

/**
 * GET  /api/social/dm/conversations          -> list caller's conversations
 * POST /api/social/dm/conversations          body: { peer_id, sealed_key_self, sealed_key_peer }
 *
 * Conversation creation is client-driven: the client generates a
 * symmetric key, seals it for both sides with their box public keys,
 * and ships the two sealed blobs here. Server only stores ciphertext.
 */

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('dm_conversations')
    .select('id, user_a_id, user_b_id, conversation_key_a, conversation_key_b, last_message_at, user_a_archived, user_b_archived, created_at')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shaped = (data ?? []).map((row) => {
    const isUserA = row.user_a_id === user.id;
    const peerId = isUserA ? row.user_b_id : row.user_a_id;
    const sealedKey = isUserA ? row.conversation_key_a : row.conversation_key_b;
    const archived = isUserA ? row.user_a_archived : row.user_b_archived;
    return {
      id: row.id,
      peer_id: peerId,
      sealed_conversation_key: sealedKey,
      last_message_at: row.last_message_at,
      archived,
      created_at: row.created_at,
    };
  });
  return NextResponse.json({ conversations: shaped });
}

const PostBody = z.object({
  peer_id: z.string().uuid(),
  sealed_key_self: z.string().min(32).max(512),
  sealed_key_peer: z.string().min(32).max(512),
});

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const decision = await canUserDM(user.id, parsed.data.peer_id);
  if (!decision.allowed) return NextResponse.json({ error: `DM not permitted: ${decision.reason}` }, { status: 403 });

  const pair = canonicalizePair(user.id, parsed.data.peer_id);
  const isUserA = pair.user_a_id === user.id;
  const sb = getSupabaseAdmin();

  // Upsert so reopening a conversation re-uses the same row + keys.
  const { data, error } = await sb
    .from('dm_conversations')
    .upsert(
      {
        user_a_id: pair.user_a_id,
        user_b_id: pair.user_b_id,
        conversation_key_a: isUserA ? parsed.data.sealed_key_self : parsed.data.sealed_key_peer,
        conversation_key_b: isUserA ? parsed.data.sealed_key_peer : parsed.data.sealed_key_self,
      },
      { onConflict: 'user_a_id,user_b_id', ignoreDuplicates: false },
    )
    .select('id, user_a_id, user_b_id, conversation_key_a, conversation_key_b, created_at, last_message_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    id: data.id,
    peer_id: parsed.data.peer_id,
    sealed_conversation_key: isUserA ? data.conversation_key_a : data.conversation_key_b,
    created_at: data.created_at,
    last_message_at: data.last_message_at,
  });
}
