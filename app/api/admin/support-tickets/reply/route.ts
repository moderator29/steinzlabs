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

    // Canonical support storage is support_tickets + ticket_replies (what the
    // admin list route and the user's support page read). This route used to
    // write to the legacy support_conversations table, so admin replies never
    // reached the user. Write to ticket_replies + bump ticket status.
    const { data: reply, error: replyErr } = await supabase
      .from('ticket_replies')
      .insert({
        ticket_id: ticketId,
        sender_type: 'admin',
        message: replyBody.trim(),
        internal: false,
      })
      .select('*')
      .single();

    if (replyErr) {
      console.error('[admin/support-tickets/reply POST] insert error:', replyErr);
      return NextResponse.json({ error: replyErr.message }, { status: 500 });
    }

    await supabase
      .from('support_tickets')
      .update({ status: 'in_progress' })
      .eq('id', ticketId)
      .eq('status', 'open');

    void logAdminAction({
      adminId,
      action: 'support_reply',
      details: { ticketId },
    });
    return NextResponse.json({ success: true, reply });
  } catch (err) {
    console.error('[admin/support-tickets/reply POST] Failed:', err);
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 });
  }
}
