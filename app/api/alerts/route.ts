import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { guardRoute } from '@/lib/api/guardRoute';

/**
 * Per-user alert CRUD backed by public.alerts. Column shape
 * (20260413_full_schema.sql):
 *   alert_type text, label text, condition jsonb, triggered boolean,
 *   active boolean, created_at timestamptz.
 *
 * The alerts page POSTs a normalized payload; we store the user-provided
 * token/threshold/direction inside the `condition` JSONB so the
 * alert-monitor cron can evaluate it without schema migrations every
 * time we add a new alert type.
 */

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

const ALERT_TYPES = ['PRICE', 'VOLUME', 'WHALE', 'ENTITY_MOVEMENT', 'SCAMMER'] as const;

const PostBody = z.object({
  alert_type: z.enum(ALERT_TYPES),
  label: z.string().min(1).max(140).optional(),
  condition: z.object({
    token: z.string().min(1).max(120),
    threshold: z.union([z.string(), z.number()]).optional(),
    direction: z.enum(['above', 'below']).optional(),
  }),
});

export async function GET() {
  const supabase = await getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('alerts')
    .select('id, alert_type, label, condition, triggered, triggered_at, active, created_at')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alerts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const guard = await guardRoute(request, { rate: 'med' });
  if (!guard.ok) return guard.response;
  const supabase = await getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = PostBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });

  const label = parsed.data.label ?? `${parsed.data.alert_type} ${parsed.data.condition.token}`;
  const { data, error } = await supabase
    .from('alerts')
    .insert({
      user_id: user.id,
      alert_type: parsed.data.alert_type,
      label,
      condition: parsed.data.condition,
      active: true,
    })
    .select('id, alert_type, label, condition, triggered, triggered_at, active, created_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alert: data });
}

export async function DELETE(request: NextRequest) {
  const guard = await guardRoute(request, { rate: 'med' });
  if (!guard.ok) return guard.response;
  const supabase = await getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const { error } = await supabase
    .from('alerts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
