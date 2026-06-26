import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { canUserDM, isBlockedBetween } from '@/lib/social/permissions';
import { RATES, takeToken } from '@/lib/social/rateLimit';
import { notifySocialEvent } from '@/lib/social/notify';

/**
 * GET  /api/social/dm/messages?conversation_id=...&before=<iso>&limit=50
 * POST /api/social/dm/messages   body: { conversation_id, encrypted_content, iv, message_type? }
 *
 * Server never touches plaintext. encrypted_content + iv are stored
 * verbatim. POST also bumps the conversation's last_message_at so
 * the inbox list orders correctly.
 */

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const conversationId = req.nextUrl.searchParams.get('conversation_id');
  if (!conversationId || !z.string().uuid().safeParse(conversationId).success) {
    return NextResponse.json({ error: 'Invalid conversation_id' }, { status: 400 });
  }
  const before = req.nextUrl.searchParams.get('before');
  const limitParam = Number(req.nextUrl.searchParams.get('limit') ?? '50');
  const limit = Math.min(200, Math.max(1, Number.isFinite(limitParam) ? limitParam : 50));

  const sb = getSupabaseAdmin();
  // Verify caller is a participant before reading.
  const { data: conv } = await sb
    .from('dm_conversations')
    .select('id, user_a_id, user_b_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (!conv || (conv.user_a_id !== user.id && conv.user_b_id !== user.id)) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
  }

  // §dm-block-bypass — even if the conversation row exists from before
  // a block, hide the history (including metadata: sender_id, timestamps,
  // read_at) once either party has blocked the other.
  const peerId = conv.user_a_id === user.id ? conv.user_b_id : conv.user_a_id;
  if (await isBlockedBetween(user.id, peerId)) {
    return NextResponse.json({ messages: [] });
  }

  let q = sb
    .from('dm_messages')
    .select('id, conversation_id, sender_id, encrypted_content, iv, message_type, created_at, read_at, deleted_at')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (before) q = q.lt('created_at', before);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

const PostBody = z.object({
  conversation_id: z.string().uuid(),
  encrypted_content: z.string().min(1).max(8192),
  iv: z.string().min(8).max(128),
  message_type: z.enum(['text', 'image', 'system']).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!takeToken(`dm:${user.id}`, RATES.dmSend)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { data: conv } = await sb
    .from('dm_conversations')
    .select('id, user_a_id, user_b_id, request_state, requested_by')
    .eq('id', parsed.data.conversation_id)
    .maybeSingle();
  if (!conv || (conv.user_a_id !== user.id && conv.user_b_id !== user.id)) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
  }

  // Replying to a pending request implicitly accepts it (X/IG behavior) —
  // only the recipient (not the original requester) can accept this way.
  if (conv.request_state === 'pending' && conv.requested_by && conv.requested_by !== user.id) {
    await sb.from('dm_conversations').update({ request_state: 'accepted' }).eq('id', conv.id);
  }

  const peerId = conv.user_a_id === user.id ? conv.user_b_id : conv.user_a_id;

  // Direction-aware block handling (shadow-block, X-style):
  //  - if the SENDER blocked the peer → they can't message them (hard stop).
  //  - if the PEER blocked the sender → the send silently "succeeds" for the
  //    sender but is never delivered or notified. The peer's inbox + history
  //    already hide blocked conversations, so they never see it.
  const [iBlocked, theyBlocked] = await Promise.all([
    sb.from('social_blocks').select('id').eq('blocker_id', user.id).eq('blocked_id', peerId).maybeSingle(),
    sb.from('social_blocks').select('id').eq('blocker_id', peerId).eq('blocked_id', user.id).maybeSingle(),
  ]);
  if (iBlocked.data) return NextResponse.json({ error: 'You blocked this user. Unblock to message them.' }, { status: 403 });
  const shadow = !!theyBlocked.data;

  // Re-verify DM permission on every send (settings can change between
  // conversation create and now). Skipped for shadow sends — the recipient
  // blocked the sender, so permission is moot and the message won't be seen.
  if (!shadow) {
    const decision = await canUserDM(user.id, peerId);
    if (!decision.allowed) return NextResponse.json({ error: `DM not permitted: ${decision.reason}` }, { status: 403 });
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from('dm_messages')
    .insert({
      conversation_id: parsed.data.conversation_id,
      sender_id: user.id,
      encrypted_content: parsed.data.encrypted_content,
      iv: parsed.data.iv,
      message_type: parsed.data.message_type ?? 'text',
    })
    .select('id, conversation_id, sender_id, encrypted_content, iv, message_type, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from('dm_conversations').update({ last_message_at: nowIso }).eq('id', parsed.data.conversation_id);

  // Fire-and-forget social notification to peer. A first message in a
  // still-pending request (sent by the requester) notifies as a "Message
  // request"; everything else is a normal "New message". Honors recipient
  // prefs + social_suspended_until inside notifySocialEvent.
  const isPendingRequest = conv.request_state === 'pending' && conv.requested_by === user.id;
  if (!shadow) {
    notifySocialEvent({
      recipient_id: peerId,
      event: isPendingRequest ? 'dm_request' : 'dm_received',
      metadata: { sender_id: user.id, conversation_id: parsed.data.conversation_id },
    }).catch(() => {});
  }

  return NextResponse.json({ message: data });
}

const PatchBody = z.object({
  message_id: z.string().uuid().optional(),
  conversation_id: z.string().uuid().optional(),
  action: z.enum(['read', 'delete', 'read_all']),
});

export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const sb = getSupabaseAdmin();

  // Bulk: mark every received message in a conversation as read (on thread open).
  if (parsed.data.action === 'read_all') {
    if (!parsed.data.conversation_id) return NextResponse.json({ error: 'conversation_id required' }, { status: 400 });
    const { data: c } = await sb
      .from('dm_conversations')
      .select('user_a_id, user_b_id')
      .eq('id', parsed.data.conversation_id)
      .maybeSingle();
    if (!c || (c.user_a_id !== user.id && c.user_b_id !== user.id)) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }
    await sb
      .from('dm_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', parsed.data.conversation_id)
      .neq('sender_id', user.id)
      .is('read_at', null);
    return NextResponse.json({ ok: true });
  }

  if (!parsed.data.message_id) return NextResponse.json({ error: 'message_id required' }, { status: 400 });
  const { data: msg } = await sb
    .from('dm_messages')
    .select('id, conversation_id, sender_id')
    .eq('id', parsed.data.message_id)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: conv } = await sb
    .from('dm_conversations')
    .select('user_a_id, user_b_id')
    .eq('id', msg.conversation_id)
    .maybeSingle();
  if (!conv || (conv.user_a_id !== user.id && conv.user_b_id !== user.id)) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
  }

  if (parsed.data.action === 'read') {
    // Anyone in the conversation can mark received messages as read.
    if (msg.sender_id === user.id) return NextResponse.json({ ok: true });
    await sb.from('dm_messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id).is('read_at', null);
    return NextResponse.json({ ok: true });
  }
  // delete: only sender can delete their own message
  if (msg.sender_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  await sb.from('dm_messages').update({ deleted_at: new Date().toISOString() }).eq('id', msg.id);
  return NextResponse.json({ ok: true });
}
