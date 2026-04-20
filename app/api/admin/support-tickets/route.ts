import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

// Admin-side ticket CRUD. Reads/writes the canonical support_tickets table
// (migration 20260420_support_tickets.sql). Can post admin replies including
// internal notes that the user never sees.

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const id = url.searchParams.get('id');

    if (id) {
      const [{ data: ticket }, { data: replies }] = await Promise.all([
        supabase.from('support_tickets').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('ticket_replies')
          .select('*')
          .eq('ticket_id', id)
          .order('created_at', { ascending: true }),
      ]);
      if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ticket, replies: replies ?? [] });
    }

    let query = supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) {
      console.error('[admin/support-tickets GET]', error);
      return NextResponse.json({ tickets: [] });
    }
    return NextResponse.json({ tickets: data ?? [] });
  } catch (err) {
    console.error('[admin/support-tickets GET]', err);
    return NextResponse.json({ tickets: [] });
  }
}

export async function PATCH(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await request.json();
    const supabase = getSupabaseAdmin();

    const updates: Record<string, unknown> = {};
    if (body.status   !== undefined && ['open', 'in_progress', 'resolved', 'closed'].includes(body.status))   updates.status   = body.status;
    if (body.priority !== undefined && ['low', 'normal', 'high', 'urgent'].includes(body.priority))            updates.priority = body.priority;
    if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { error } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[admin/support-tickets PATCH]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/support-tickets PATCH]', err);
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}

// Admin posts a reply (optionally internal-only)
export async function POST(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const body = await request.json() as {
      ticket_id?: string;
      message?: string;
      internal?: boolean;
    };
    if (!body.ticket_id || !body.message?.trim()) {
      return NextResponse.json({ error: 'ticket_id and message required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: reply, error: rErr } = await supabase
      .from('ticket_replies')
      .insert({
        ticket_id: body.ticket_id,
        sender_type: 'admin',
        message: body.message.trim(),
        internal: body.internal === true,
      })
      .select('*')
      .single();

    if (rErr) {
      console.error('[admin/support-tickets POST]', rErr);
      return NextResponse.json({ error: rErr.message }, { status: 500 });
    }

    // Auto-bump status to in_progress when admin responds.
    if (!body.internal) {
      await supabase
        .from('support_tickets')
        .update({ status: 'in_progress' })
        .eq('id', body.ticket_id)
        .eq('status', 'open');

      // Push a Telegram + in-app notification to the ticket owner.
      try {
        const { data: ticket } = await supabase
          .from('support_tickets')
          .select('user_id, subject')
          .eq('id', body.ticket_id)
          .maybeSingle();
        if (ticket?.user_id) {
          const { queueTelegramNotification } = await import('@/lib/telegram/notify');
          queueTelegramNotification({
            userId: ticket.user_id as string,
            kind: 'general',
            title: `Support update: ${String(ticket.subject).slice(0, 80)}`,
            body: body.message.slice(0, 240),
            url: `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/dashboard/support`,
          });
        }
      } catch (err) {
        console.warn('[admin/support-tickets] notify failed:', err);
      }
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('[admin/support-tickets POST]', err);
    return NextResponse.json({ error: 'Failed to post reply' }, { status: 500 });
  }
}
