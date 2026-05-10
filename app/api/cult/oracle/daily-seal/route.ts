import { NextRequest, NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

/**
 * GET /api/cult/oracle/daily-seal — latest available Daily Seal.
 *
 * Returns today's seal if generated; otherwise the most recent seal so the
 * Oracle never renders empty. Empty payload + 200 if none have ever been
 * generated (the UI shows "the Oracle is silent").
 */
export async function GET(_req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cult_daily_seals')
    .select('seal_date, title, body, generated_at')
    .order('seal_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ seal: data ?? null });
}
