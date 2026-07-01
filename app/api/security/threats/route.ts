import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Live threat feed for the signed-in user's Security Center.
 *
 * Reads real rows from public.security_alerts (per-user, RLS-guarded) ordered
 * newest first. Returns an honest empty list when the user has no alerts. No
 * severity, source, or timestamp is fabricated. Each row carries the upstream
 * provider that raised it (GoPlus, Alchemy, OFAC list, …) in `source`.
 */

interface FeedRow {
  id: string;
  severity: string;
  title: string;
  description: string | null;
  source: string | null;
  category: string | null;
  target: string | null;
  acknowledged: boolean;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  try {
    const { data, error } = await admin
      .from('security_alerts')
      .select('id, severity, title, description, source, category, target, acknowledged, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<FeedRow[]>();

    // Table not yet migrated → honest empty feed, not an error surface.
    if (error) {
      return NextResponse.json({ alerts: [], available: false });
    }

    return NextResponse.json({ alerts: data ?? [], available: true });
  } catch {
    return NextResponse.json({ alerts: [], available: false });
  }
}
