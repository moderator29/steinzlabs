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

interface SubscribeBody {
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  vapidKeyVersion?: number | null;
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json() as SubscribeBody;
    if (
      !body?.subscription?.endpoint ||
      !body?.subscription?.keys?.p256dh ||
      !body?.subscription?.keys?.auth
    ) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent')?.slice(0, 200) ?? null;

    // Live push_subscriptions schema is flat: endpoint/p256dh/auth as columns,
    // unique on endpoint. Upsert so the same device re-subscribing updates its
    // row (and reassigns ownership) instead of duplicating.
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        endpoint: body.subscription.endpoint,
        p256dh: body.subscription.keys.p256dh,
        auth: body.subscription.keys.auth,
        user_agent: userAgent,
        vapid_key_version: body.vapidKeyVersion ?? null,
      }, {
        onConflict: 'endpoint',
        ignoreDuplicates: false,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create default notification settings row if not exists
    await supabase.from('notification_settings').upsert(
      { user_id: user.id },
      { onConflict: 'user_id', ignoreDuplicates: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Subscribe failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
