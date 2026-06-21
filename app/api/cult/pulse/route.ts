import { NextRequest, NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

/**
 * GET /api/cult/pulse — Signal Pulse: the cult-only on-chain signal stream.
 *
 * Returns the most recent signals (newest first). Any cult member may read.
 * Signals are written by the cult signal pipeline / admin (cult_signals);
 * this is the read surface the Pulse panel renders.
 */
export async function GET(_req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cult_signals')
    .select('id, kind, title, detail, severity, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ signals: data ?? [] });
}
