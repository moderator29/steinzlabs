import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * GDPR data export. Returns a JSON archive of every row of the
 * authenticated user's data across the platform — profile, alerts,
 * watchlist, sniper rules, copy-trade rules, follow list, login
 * activity, notification preferences. Wrapped in Content-Disposition
 * attachment so the browser downloads it as a file.
 *
 * Audit §B.6 P1. Article 20 GDPR — right to portability.
 */

const TABLES: Array<{ table: string; column: string }> = [
  { table: 'profiles', column: 'id' },
  { table: 'alerts', column: 'user_id' },
  { table: 'user_watchlist', column: 'user_id' },
  { table: 'user_follow_list', column: 'user_id' },
  { table: 'sniper_rules', column: 'user_id' },
  { table: 'user_copy_rules', column: 'user_id' },
  { table: 'login_activity', column: 'user_id' },
  { table: 'notification_settings', column: 'user_id' },
  { table: 'user_preferences', column: 'user_id' },
  { table: 'user_telegram_links', column: 'user_id' },
];

export async function GET(_request: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const archive: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      userId,
    };

    await Promise.all(
      TABLES.map(async ({ table, column }) => {
        try {
          const { data, error } = await supabase.from(table).select('*').eq(column, userId);
          archive[table] = error ? { error: error.message } : (data ?? []);
        } catch (err) {
          archive[table] = { error: err instanceof Error ? err.message : 'unknown' };
        }
      }),
    );

    const body = JSON.stringify(archive, null, 2);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="naka-data-${userId}-${Date.now()}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'gdpr-export' } });
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
