import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';

/**
 * §3 P2-C.7 — shareable network-graph snapshots.
 *
 * POST body { snapshot, focus_wallet? } → { short_code, url }
 *   Persists the snapshot to network_graph_shares, generates a 10-char
 *   short_code, returns the public path.
 *
 * GET ?code=abc123 → { snapshot, focus_wallet, created_at }
 *   Increments view_count and returns the snapshot for the share-link
 *   landing page.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    },
  );
}

function generateShortCode(): string {
  return crypto.randomBytes(7).toString('base64url').slice(0, 10);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { snapshot?: unknown; focus_wallet?: string };
  if (!body.snapshot || typeof body.snapshot !== 'object') {
    return NextResponse.json({ error: 'snapshot required' }, { status: 400 });
  }
  const snapshotStr = JSON.stringify(body.snapshot);
  if (snapshotStr.length > 1_000_000) {
    return NextResponse.json({ error: 'snapshot too large (max 1MB)' }, { status: 413 });
  }

  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();

  const admin = getSupabaseAdmin();
  const short_code = generateShortCode();
  const { error } = await admin
    .from('network_graph_shares')
    .insert({
      short_code,
      user_id: user?.id ?? null,
      focus_wallet: body.focus_wallet ?? null,
      snapshot: body.snapshot,
    });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    short_code,
    url: `/network-graph/share/${short_code}`,
  });
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim();
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('network_graph_shares')
    .select('snapshot, focus_wallet, created_at, view_count')
    .eq('short_code', code)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Bump view_count fire-and-forget — don't gate the response on it.
  void admin
    .from('network_graph_shares')
    .update({ view_count: (data.view_count ?? 0) + 1 })
    .eq('short_code', code);

  return NextResponse.json({
    snapshot: data.snapshot,
    focus_wallet: data.focus_wallet,
    created_at: data.created_at,
  });
}
