import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Generic user-preferences store. Keyed by user_id, value is the full
// preferences JSONB blob. Any feature that wants to persist a user
// setting can PATCH a single key here and the server merges it in.

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
  const { data } = await supabase
    .from('user_preferences')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle();
  return NextResponse.json({ preferences: data?.preferences ?? {} });
}

export async function PATCH(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  const { data: existing } = await supabase
    .from('user_preferences')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle();

  const merged = { ...(existing?.preferences ?? {}), ...patch };

  const { error: upErr } = await supabase
    .from('user_preferences')
    .upsert({ user_id: user.id, preferences: merged, updated_at: new Date().toISOString() });

  if (upErr) {
    console.error('[user/preferences] upsert', upErr);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
  return NextResponse.json({ preferences: merged });
}
