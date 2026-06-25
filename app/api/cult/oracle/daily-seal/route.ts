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
 *
 * Freshness: the response carries `is_today` and `stale` (older than 48h) so
 * the UI never presents a weeks-old seal as today's briefing — a stale seal
 * stopped the cron from regenerating once and the Oracle silently served a
 * 43-day-old seal as current.
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

  if (!data) {
    return NextResponse.json({ seal: null, is_today: false, stale: false, age_days: null });
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const sealMs = new Date(data.seal_date + 'T00:00:00Z').getTime();
  const ageDays = Math.max(0, Math.floor((Date.now() - sealMs) / 86_400_000));
  return NextResponse.json({
    seal: data,
    is_today: data.seal_date === today,
    stale: ageDays >= 2, // older than 48h
    age_days: ageDays,
  });
}
