import { NextRequest, NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

/**
 * GET /api/cult/sanctum/library — Library catalog.
 *
 * Returns the active ambient tracks ordered by display_order. Each track's
 * storage_path is either a relative MP3 (/audio/<file>.mp3) or a
 * 'spotify:playlist:<id>' marker the LibraryPlayer recognizes and embeds.
 */
export async function GET(_req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cult_ambient_tracks')
    .select('id, title, artist, storage_path, duration_seconds, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tracks: data ?? [] });
}
