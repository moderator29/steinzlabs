import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * OV3: dashboard widget order persistence. Lives inside
 * user_preferences.preferences as a JSON array of widget slugs so no
 * separate column / migration is required. The dashboard reads this on
 * mount and renders widgets in the saved order; a follow-up branch
 * wires the drag-drop UI (HTML5 native, no react-beautiful-dnd dep —
 * the abandoned library isn't worth carrying for this).
 */

export const runtime = 'nodejs';

const VALID_WIDGETS = ['hero', 'digest', 'markets', 'gainers', 'heating', 'context-feed', 'top-gainers'] as const;

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

export async function GET(_req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('user_preferences')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle<{ preferences: { dashboard_widgets?: unknown } | null }>();

  const stored = data?.preferences?.dashboard_widgets;
  const widgets = Array.isArray(stored)
    ? stored.filter((s): s is string => typeof s === 'string')
    : [];

  return NextResponse.json({ widgets, supported: VALID_WIDGETS });
}

const PatchBody = z.object({
  widgets: z.array(z.enum(VALID_WIDGETS)).max(20),
});

export async function PATCH(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  // Read-modify-write so we don't clobber any other keys in the
  // preferences blob (muted_feed_sources from Branch 19 etc).
  const { data: row } = await admin
    .from('user_preferences')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle<{ preferences: Record<string, unknown> | null }>();
  const next = { ...(row?.preferences ?? {}), dashboard_widgets: parsed.data.widgets };

  const { error } = await admin
    .from('user_preferences')
    .upsert({ user_id: user.id, preferences: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, widgets: parsed.data.widgets });
}
