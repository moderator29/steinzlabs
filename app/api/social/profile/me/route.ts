import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * PATCH /api/social/profile/me  — caller updates their own social
 * privacy / display settings. Subset-of-columns whitelist; everything
 * else (tier, role, verified status) is admin-only and never settable
 * via this route.
 */

const Body = z.object({
  is_private:           z.boolean().optional(),
  dm_permission:        z.enum(['everyone','following','mutual','nobody']).optional(),
  show_success_rate:    z.boolean().optional(),
  show_wallet_balance:  z.boolean().optional(),
  show_activity:        z.boolean().optional(),
  bio:                  z.string().max(500).optional(),
  social_links:         z.record(z.string(), z.string().url().max(512)).optional(),
});

export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const sb = getSupabaseAdmin();
  const { error } = await sb.from('profiles').update(parsed.data).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
