import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';
import { logAdminAction } from '@/lib/admin/auditLog';

const Body = z.object({
  ticketId: z.string().min(1).max(64),
  body: z.string().min(1).max(8_000),
});

export async function POST(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.issues }, { status: 400 });
    }
    const { ticketId, body: replyBody } = parsed.data;

    const supabase = getSupabaseAdmin();

    // Fetch existing replies
    const { data: ticket, error: fetchError } = await supabase
      .from('support_conversations')
      .select('replies')
      .eq('id', ticketId)
      .single();

    if (fetchError) {
      console.error('[admin/support-tickets/reply POST] Fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const existingReplies = Array.isArray(ticket?.replies) ? ticket.replies : [];
    const newReply = { from: 'admin', body: replyBody.trim(), ts: Date.now() };
    const updatedReplies = [...existingReplies, newReply];

    const { error: updateError } = await supabase
      .from('support_conversations')
      .update({ replies: updatedReplies, status: 'in_progress' })
      .eq('id', ticketId);

    if (updateError) {
      console.error('[admin/support-tickets/reply POST] Update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    void logAdminAction({
      adminId,
      action: 'support_reply',
      details: { ticketId, conversation: true, replyCount: updatedReplies.length },
    });
    return NextResponse.json({ success: true, reply: newReply });
  } catch (err) {
    console.error('[admin/support-tickets/reply POST] Failed:', err);
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 });
  }
}
