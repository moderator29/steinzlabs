import 'server-only';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Smart Alert trigger history for the caller. Reads the real notifications the
 * alert-monitor cron wrote when a Smart Alert fired (notifications.metadata
 * carries { smart_alert_id, smart_alert_type }), so history survives tab-close
 * and syncs across devices instead of living in localStorage.
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
        getAll: () => cookieStore.getAll(),
        setAll: () => { /* read-only */ },
      },
    },
  );
}

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  type: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export async function GET() {
  const supabase = await getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, type, created_at, metadata')
    .eq('user_id', user.id)
    .contains('metadata', { source: 'smart_alert' })
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const history = (data ?? []).map((r) => {
    const row = r as NotificationRow;
    const meta = row.metadata ?? {};
    return {
      id: row.id,
      alertName: row.title,
      alertType: typeof meta.smart_alert_type === 'string' ? meta.smart_alert_type : row.type,
      message: row.body,
      triggeredAt: new Date(row.created_at).getTime(),
    };
  });

  return NextResponse.json({ history });
}
