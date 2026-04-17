import 'server-only';
import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) are required');
  }
  _supabase = createClient(url, key);
  return _supabase;
}

function auth(req: Request) {
  const h = req.headers.get('authorization') ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

export async function GET(request: Request) {
  const supabase = getSupabase();
  const token = auth(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const { data, error: dbErr } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (dbErr || !data) {
    // Return defaults if no row yet
    return NextResponse.json({
      whale_alerts_enabled: true, whale_min_trade_usd: 50000,
      whale_buys: true, whale_sells: true, whale_convergence: true,
      convergence_min_whales: 3, smart_money_enabled: true,
      price_alerts_enabled: true, trend_alerts_enabled: true,
      quiet_hours_enabled: false, quiet_start: '22:00', quiet_end: '08:00',
      quiet_timezone: 'UTC', quiet_exceptions: ['convergence'],
      email_backup_enabled: false,
    });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const supabase = getSupabase();
  const token = auth(request);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const body = await request.json() as Record<string, unknown>;
  const allowed = [
    'whale_alerts_enabled', 'whale_min_trade_usd', 'whale_buys', 'whale_sells',
    'whale_convergence', 'convergence_min_whales', 'smart_money_enabled',
    'price_alerts_enabled', 'trend_alerts_enabled', 'quiet_hours_enabled',
    'quiet_start', 'quiet_end', 'quiet_timezone', 'quiet_exceptions',
    'email_backup_enabled',
  ];
  const patch: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
  for (const k of allowed) if (k in body) patch[k] = body[k];

  const { error: upsertErr } = await supabase
    .from('notification_settings')
    .upsert(patch, { onConflict: 'user_id', ignoreDuplicates: false });

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
