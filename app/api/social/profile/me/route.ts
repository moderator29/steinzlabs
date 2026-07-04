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
  // Real contact email for wallet users (whose auth email is synthetic
  // {address}@wallet.nakalabs.xyz). Empty string clears it.
  contact_email:        z.union([z.string().email().max(254), z.literal('')]).optional(),
});

/** GET — the caller's own contact-email state, so the profile can decide
 *  whether to show a real email or an "Add email" field for wallet users. */
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('profiles').select('contact_email').eq('id', user.id).maybeSingle<{ contact_email: string | null }>();
  const authEmail = (user as { email?: string }).email ?? null;
  // Synthetic auth email minted for wallet signups — never surfaced as "email".
  const isWalletEmail = !!authEmail && /@wallet\.nakalabs\./i.test(authEmail);
  return NextResponse.json({
    contactEmail: data?.contact_email ?? null,
    authEmail: isWalletEmail ? null : authEmail,
    isWalletUser: isWalletEmail,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  // Stamp contact_email_added_at when a real email is set (cleared → null).
  const update: Record<string, unknown> = { ...parsed.data };
  if ('contact_email' in parsed.data) {
    const val = parsed.data.contact_email?.trim() || null;
    update.contact_email = val;
    update.contact_email_added_at = val ? new Date().toISOString() : null;
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.from('profiles').update(update).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
