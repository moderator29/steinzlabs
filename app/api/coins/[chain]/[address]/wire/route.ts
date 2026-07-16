import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveCoin } from '@/lib/coins/coinService';

export const dynamic = 'force-dynamic';

const MAX = 500;

/**
 * The coin's slice of The Wire. Reads are served by the main Wire feed
 * (`/api/wire/posts?cashtag=<ticker>`) so the coin Wire renders the exact same
 * rich, annotated posts as the platform feed; this route only handles POSTing a
 * new wire that carries the coin's ticker. Real data only.
 */

/** Post to the coin's Wire. Creates a real wire post that carries the ticker. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await ctx.params;
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const coin = await resolveCoin(chain, decodeURIComponent(address)).catch(() => null);
  const symbol = coin?.symbol?.trim();
  const safe = symbol ? symbol.replace(/[^a-zA-Z0-9]/g, '') : '';
  if (!safe) return NextResponse.json({ error: 'Coin not found' }, { status: 404 });

  const { body } = (await req.json().catch(() => ({}))) as { body?: string };
  let text = (body ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Empty post' }, { status: 400 });
  if (text.length > MAX) return NextResponse.json({ error: 'Post too long' }, { status: 400 });
  // Guarantee the ticker is present so it lands in this coin's Wire.
  if (!new RegExp(`\\$${safe}\\b`, 'i').test(text)) text = `${text} $${safe}`;

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('wire_posts')
    // Store the ticker tag lowercased so the coin Wire's cashtag filter (which
    // matches on the lowercased ticker) finds it via exact tag containment.
    .insert({ author_id: user.id, body: text, tags: [safe.toLowerCase()], audience: 'everyone' })
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Could not post' }, { status: 500 });
  return NextResponse.json({ id: (data as { id: string })?.id });
}
