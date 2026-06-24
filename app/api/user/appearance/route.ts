import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { DEFAULT_APPEARANCE, type Appearance } from '@/lib/theme/appearance';

/**
 * §3.4 — per-user appearance settings, persisted on user_display_preferences.
 * Auth via the user's session; the row is read/written through the admin
 * client bound explicitly to `user_id` (same pattern as the widgets route),
 * so we never depend on RLS edge cases for this singleton row.
 */

export const runtime = 'nodejs';

interface PrefRow {
  theme: string | null;
  accent: string | null;
  glass_intensity: string | null;
  text_size: string | null;
  reduced_motion: boolean | null;
  compact_mode: boolean | null;
}

function rowToAppearance(row: PrefRow | null): Appearance {
  if (!row) return DEFAULT_APPEARANCE;
  return {
    theme: (row.theme as Appearance['theme']) ?? DEFAULT_APPEARANCE.theme,
    accent: (row.accent as Appearance['accent']) ?? DEFAULT_APPEARANCE.accent,
    glass: (row.glass_intensity as Appearance['glass']) ?? DEFAULT_APPEARANCE.glass,
    textSize: (row.text_size as Appearance['textSize']) ?? DEFAULT_APPEARANCE.textSize,
    density: row.compact_mode ? 'compact' : 'comfortable',
    motion: row.reduced_motion ? 'reduced' : 'full',
  };
}

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value, set() {}, remove() {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('user_display_preferences')
    .select('theme, accent, glass_intensity, text_size, reduced_motion, compact_mode')
    .eq('user_id', userId)
    .maybeSingle<PrefRow>();

  return NextResponse.json({ appearance: rowToAppearance(data) });
}

const PatchBody = z.object({
  theme: z.enum(['dark', 'light', 'system']),
  accent: z.enum(['blue', 'violet', 'teal', 'crimson', 'gold']),
  glass: z.enum(['off', 'subtle', 'full']),
  density: z.enum(['comfortable', 'compact']),
  textSize: z.enum(['small', 'default', 'large']),
  motion: z.enum(['full', 'reduced']),
});

export async function PATCH(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
  }
  const a = parsed.data;

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('user_display_preferences')
    .upsert(
      {
        user_id: userId,
        theme: a.theme,
        accent: a.accent,
        glass_intensity: a.glass,
        text_size: a.textSize,
        compact_mode: a.density === 'compact',
        reduced_motion: a.motion === 'reduced',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, appearance: a });
}
