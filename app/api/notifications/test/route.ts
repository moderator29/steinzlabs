import 'server-only';
import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { sendPushToUser } from '@/lib/services/webpush';

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

// POST /api/notifications/test — Admin only, sends test push to a user
export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const adminSecret = request.headers.get('x-admin-secret');
    if (!adminSecret || adminSecret !== process.env.ADMIN_MIGRATION_SECRET) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { userId } = await request.json() as { userId?: string };
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Verify user exists
    const { data: user } = await supabase.auth.admin.getUserById(userId);
    if (!user?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await sendPushToUser(userId, {
      title: '✅ Naka Labs Notifications Active',
      body: 'Whale alerts, convergence signals, and price alerts will appear here.',
      icon: '/steinz-logo-192.png',
      url: '/dashboard',
      tag: 'test-notification',
    });

    return NextResponse.json({ ok: true, message: 'Test notification sent' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Test failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
