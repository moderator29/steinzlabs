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
  deviceInfo?: string;
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
    if (!body?.subscription?.endpoint || !body?.subscription?.keys) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }

    const ua = request.headers.get('user-agent') ?? '';
    const deviceInfo = body.deviceInfo ?? (
      ua.includes('iPhone') || ua.includes('iPad') ? 'iOS Safari' :
      ua.includes('Android') ? 'Android' :
      ua.includes('Chrome') ? 'Chrome' :
      ua.includes('Firefox') ? 'Firefox' : 'Browser'
    );

    // Upsert by endpoint — same device re-subscribing should update, not duplicate
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: user.id,
        subscription: body.subscription,
        device_info: deviceInfo,
        is_active: true,
        last_used_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,subscription->endpoint',
        ignoreDuplicates: false,
      });

    if (error) {
      // Fallback: plain insert if upsert fails (endpoint not unique constrained)
      await supabase.from('push_subscriptions').insert({
        user_id: user.id,
        subscription: body.subscription,
        device_info: deviceInfo,
        is_active: true,
      });
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
