import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const [viewsRes, likesRes, sharesRes] = await Promise.all([
      supabase.from('engagement').select('*', { count: 'exact', head: true }).eq('action', 'view'),
      supabase.from('engagement').select('*', { count: 'exact', head: true }).eq('action', 'like'),
      supabase.from('engagement').select('*', { count: 'exact', head: true }).eq('action', 'share'),
    ]);

    return NextResponse.json({
      views: viewsRes.count ?? 0,
      likes: likesRes.count ?? 0,
      shares: sharesRes.count ?? 0,
    });
  } catch {
    return NextResponse.json({ views: 0, likes: 0, shares: 0 });
  }
}
