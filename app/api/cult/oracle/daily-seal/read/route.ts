import { NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { grantAchievement } from '@/lib/cult/achievements';

export const runtime = 'nodejs';

/**
 * POST /api/cult/oracle/daily-seal/read — the caller broke the wax on a Daily
 * Seal. Grants the one-time "First Seal" achievement (idempotent; a re-break is
 * a silent no-op). No body required.
 */
export async function POST() {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  await grantAchievement(access.userId, 'first_seal_read');
  return NextResponse.json({ ok: true });
}
