import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { RATES, takeToken } from '@/lib/social/rateLimit';

const Body = z.object({
  reported_id: z.string().uuid(),
  category: z.enum(['spam', 'harassment', 'scam', 'impersonation', 'other']),
  reason: z.string().min(4).max(2000),
});

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!takeToken(`report:${user.id}`, RATES.report)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  if (parsed.data.reported_id === user.id) return NextResponse.json({ error: 'Cannot report yourself' }, { status: 400 });

  const { error } = await getSupabaseAdmin().from('user_reports').insert({
    reporter_id: user.id,
    reported_id: parsed.data.reported_id,
    category: parsed.data.category,
    reason: parsed.data.reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
