import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * §3 P2-F.8 — alert templates library. Public read; returns the
 * curated recipes seeded by the migration. UI renders these in a
 * picker; clicking instantiates into composite_alerts via the existing
 * POST /api/alerts/composite endpoint.
 */
export const runtime = 'nodejs';

export async function GET() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('alert_templates')
    .select('id, slug, title, description, category, expression, default_cooldown_seconds')
    .order('category', { ascending: true })
    .order('title', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}
