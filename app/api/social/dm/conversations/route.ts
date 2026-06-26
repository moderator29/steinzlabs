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
    .select('id, user_a_id, user_b_id, conversation_key_a, conversation_key_b, last_message_at, user_a_archived, user_b_archived, created_at, request_state, requested_by')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .neq('request_state', 'declined')
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shaped = (data ?? []).map((row) => {
    const isUserA = row.user_a_id === user.id;
    const peerId = isUserA ? row.user_b_id : row.user_a_id;
    const sealedKey = isUserA ? row.conversation_key_a : row.conversation_key_b;
    const archived = isUserA ? row.user_a_archived : row.user_b_archived;
    // A pending conversation is a "request" only for the recipient (the one
    // who did NOT initiate it). The initiator sees it in their normal inbox.
    const isRequest = row.request_state === 'pending' && row.requested_by !== user.id;
    return {
      id: row.id,
      peer_id: peerId,
      sealed_conversation_key: sealedKey,
      last_message_at: row.last_message_at,
      archived,
      created_at: row.created_at,
      request_state: row.request_state,
      is_request: isRequest,
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

  // Decide whether this conversation goes straight to the peer's inbox or
  // lands in their Requests tab (X/IG model). It's accepted when the peer
  // already follows the sender (or they're mutual); otherwise it's a pending
  // request initiated by the sender. Only applied on INSERT (ignoreDuplicates
  // keeps an existing conversation's state untouched).
  const { data: peerFollowsMe } = await sb
    .from('social_follows')
    .select('id')
    .eq('follower_id', parsed.data.peer_id)
    .eq('following_id', user.id)
    .eq('status', 'accepted')
    .maybeSingle();
  const requestState = peerFollowsMe ? 'accepted' : 'pending';

  // Insert the conversation only if it does not exist yet. ignoreDuplicates
  // (ON CONFLICT DO NOTHING) means an existing row KEEPS its original keys —
  // reopening a thread must never overwrite the conversation key, or every
  // message sent under the old key becomes permanently undecryptable. (The
  // previous upsert used ignoreDuplicates:false, which UPDATEd the keys on
  // every open and silently destroyed history.)
  const { error: insertError } = await sb
    .from('dm_conversations')
    .upsert(
      {
        user_a_id: pair.user_a_id,
        user_b_id: pair.user_b_id,
        conversation_key_a: isUserA ? parsed.data.sealed_key_self : parsed.data.sealed_key_peer,
        conversation_key_b: isUserA ? parsed.data.sealed_key_peer : parsed.data.sealed_key_self,
        request_state: requestState,
        requested_by: requestState === 'pending' ? user.id : null,
      },
      { onConflict: 'user_a_id,user_b_id', ignoreDuplicates: true },
    );
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Read back the authoritative stored keys: the original ones if the row
  // already existed, the just-inserted ones for a brand-new conversation.
  const { data, error } = await sb
    .from('dm_conversations')
    .select('id, user_a_id, user_b_id, conversation_key_a, conversation_key_b, created_at, last_message_at')
    .eq('user_a_id', pair.user_a_id)
    .eq('user_b_id', pair.user_b_id)
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Conversation lookup failed' }, { status: 500 });
  }
  return NextResponse.json({
    id: data.id,
    peer_id: parsed.data.peer_id,
    sealed_conversation_key: isUserA ? data.conversation_key_a : data.conversation_key_b,
    created_at: data.created_at,
    last_message_at: data.last_message_at,
  });
}

const PatchBody = z.object({
  conversation_id: z.string().uuid(),
  action: z.enum(['accept', 'decline']),
});

/** Accept or decline a pending message request. Only the recipient (the
 *  participant who did NOT initiate the request) may act on it. */
export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: convo } = await sb
    .from('dm_conversations')
    .select('id, user_a_id, user_b_id, request_state, requested_by')
    .eq('id', parsed.data.conversation_id)
    .maybeSingle();
  if (!convo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isParticipant = convo.user_a_id === user.id || convo.user_b_id === user.id;
  // The recipient is the participant who didn't send the request.
  if (!isParticipant || convo.requested_by === user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const next = parsed.data.action === 'accept' ? 'accepted' : 'declined';
  const { error } = await sb
    .from('dm_conversations')
    .update({ request_state: next })
    .eq('id', convo.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, request_state: next });
}
