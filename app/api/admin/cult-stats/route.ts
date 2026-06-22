import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest } from '@/lib/auth/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Admin → NakaCult overview stats. Returns the live threshold + a
 * member count from profiles where cult_member = true. Admin-gated.
 */

const THRESHOLD = Number(process.env.NAKA_HOLDING_THRESHOLD ?? '1227000');

export async function GET(request: NextRequest) {
  const adminUser = await verifyAdminRequest(request);
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { count: totalMembers, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('cult_member', true);

  if (error) {
    return NextResponse.json(
      { threshold: THRESHOLD, totalMembers: null, nftMembers: null, holdingMembers: null },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      threshold: THRESHOLD,
      totalMembers: totalMembers ?? 0,
      // Holding-vs-NFT split needs a column we don't store today; the
      // resolver derives the path at access-check time, not durably.
      // Leaving null so the UI hides those sub-totals until a
      // membership-source column is added.
      nftMembers: null,
      holdingMembers: null,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
