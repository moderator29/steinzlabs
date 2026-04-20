import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_CATEGORIES = new Set(['wallet', 'swap', 'payments', 'bug', 'feature', 'account', 'other']);

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

export async function GET() {
  const supabase = await getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data, error: qErr } = await supabase
    .from('support_tickets')
    .select('id, subject, category, status, priority, created_at, updated_at, resolved_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (qErr) {
    console.error('[support/tickets GET]', qErr);
    return NextResponse.json({ tickets: [] });
  }
  return NextResponse.json({ tickets: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    subject?: string;
    description?: string;
    category?: string;
    priority?: string;
  };

  const subject = (body.subject ?? '').trim();
  const description = (body.description ?? '').trim();
  const category = VALID_CATEGORIES.has(body.category ?? '') ? (body.category as string) : 'other';
  const priority = ['low', 'normal', 'high', 'urgent'].includes(body.priority ?? '') ? body.priority : 'normal';

  if (subject.length < 3 || subject.length > 200) {
    return NextResponse.json({ error: 'Subject must be 3–200 characters.' }, { status: 400 });
  }
  if (description.length < 10 || description.length > 5000) {
    return NextResponse.json({ error: 'Description must be 10–5000 characters.' }, { status: 400 });
  }

  const { data, error: insErr } = await supabase
    .from('support_tickets')
    .insert({
      user_id: user.id,
      user_email: user.email ?? null,
      subject,
      description,
      category,
      priority,
      status: 'open',
    })
    .select('id, subject, category, status, priority, created_at')
    .single();

  if (insErr) {
    console.error('[support/tickets POST]', insErr);
    return NextResponse.json({ error: 'Failed to create ticket.' }, { status: 500 });
  }

  return NextResponse.json({ ticket: data });
}
