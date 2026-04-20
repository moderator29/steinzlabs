import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const [{ data: ticket, error: tErr }, { data: replies }] = await Promise.all([
    supabase.from('support_tickets').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('ticket_replies')
      .select('id, sender_type, message, created_at')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true }),
  ]);

  if (tErr || !ticket) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
  if (ticket.user_id !== user.id) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  return NextResponse.json({ ticket, replies: replies ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { message?: string };
  const message = (body.message ?? '').trim();
  if (message.length < 1 || message.length > 5000) {
    return NextResponse.json({ error: 'Message must be 1–5000 characters.' }, { status: 400 });
  }

  // RLS enforces user ownership on insert.
  const { data, error: rErr } = await supabase
    .from('ticket_replies')
    .insert({
      ticket_id: id,
      sender_type: 'user',
      sender_id: user.id,
      message,
      internal: false,
    })
    .select('id, sender_type, message, created_at')
    .single();

  if (rErr) {
    console.error('[support/tickets reply POST]', rErr);
    return NextResponse.json({ error: 'Failed to post reply.' }, { status: 500 });
  }

  return NextResponse.json({ reply: data });
}
