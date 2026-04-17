import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('sniper_executions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[admin/sniper-executions] Query error:', error);
      return NextResponse.json({ executions: [] });
    }

    return NextResponse.json({ executions: data || [] });
  } catch (err) {
    console.error('[admin/sniper-executions] Failed:', err);
    return NextResponse.json({ executions: [] });
  }
}
