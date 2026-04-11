import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const ADMIN_PASSWORD = '195656';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    const [
      { count: totalUsers },
      { count: totalProfiles },
      { data: recentUsers },
      { count: verifiedUsers },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('id, first_name, last_name, username, email, created_at').order('created_at', { ascending: false }).limit(20),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_verified_entity', true),
    ]);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      { count: todaySignups },
      { count: weekSignups },
      { count: totalScans },
      { count: totalPositions },
      { count: activePositions },
      { count: totalThreats },
      { count: totalAlerts },
      { count: followedEntities },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo.toISOString()),
      supabase.from('scans').select('*', { count: 'exact', head: true }),
      supabase.from('positions').select('*', { count: 'exact', head: true }),
      supabase.from('positions').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      supabase.from('threats').select('*', { count: 'exact', head: true }),
      supabase.from('alerts').select('*', { count: 'exact', head: true }),
      supabase.from('followed_entities').select('*', { count: 'exact', head: true }),
    ]);

    let engagementTotals = { views: 0, likes: 0, shares: 0 };
    try {
      const engRes = await fetch(`${request.url.split('/api/')[0]}/api/engagement/totals`);
      if (engRes.ok) {
        engagementTotals = await engRes.json();
      }
    } catch {}

    return NextResponse.json({
      users: {
        total: totalUsers || 0,
        profiles: totalProfiles || 0,
        verified: verifiedUsers || 0,
        todaySignups: todaySignups || 0,
        weekSignups: weekSignups || 0,
        recentUsers: recentUsers || [],
      },
      platform: {
        totalScans: totalScans || 0,
        totalPositions: totalPositions || 0,
        activePositions: activePositions || 0,
        totalThreats: totalThreats || 0,
        totalAlerts: totalAlerts || 0,
        followedEntities: followedEntities || 0,
      },
      engagement: engagementTotals,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {

    return NextResponse.json({
      users: { total: 0, profiles: 0, verified: 0, todaySignups: 0, weekSignups: 0, recentUsers: [] },
      platform: { totalScans: 0, totalPositions: 0, activePositions: 0, totalThreats: 0, totalAlerts: 0, followedEntities: 0 },
      engagement: { views: 0, likes: 0, shares: 0 },
      timestamp: new Date().toISOString(),
    });
  }
}
