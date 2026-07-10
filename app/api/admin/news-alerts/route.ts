import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';

/**
 * News alerts / digest — opt-in reach + delivery health.
 *
 * GET /api/admin/news-alerts
 *
 * Reads notification_settings (news_alerts, telegram_enabled, email_enabled,
 * push_enabled) for opt-in reach, and cron_execution_log rows for the
 * 'news-digest' cron (the job that fans the crypto news digest out to opted-in
 * users) for the last send stats. Column is cron_name, not name.
 */

const DIGEST_CRON = 'news-digest';

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const sb = getSupabaseAdmin();

    // Opt-in reach + channel breakdown among opted-in users.
    const [optedInRes, telegramRes, emailRes, pushRes] = await Promise.all([
      sb.from('notification_settings').select('*', { count: 'exact', head: true }).eq('news_alerts', true),
      sb.from('notification_settings').select('*', { count: 'exact', head: true }).eq('news_alerts', true).eq('telegram_enabled', true),
      sb.from('notification_settings').select('*', { count: 'exact', head: true }).eq('news_alerts', true).eq('email_enabled', true),
      sb.from('notification_settings').select('*', { count: 'exact', head: true }).eq('news_alerts', true).eq('push_enabled', true),
    ]);

    // Recent digest cron runs.
    const { data: runs } = await sb
      .from('cron_execution_log')
      .select('id, cron_name, status, duration_ms, items_processed, error_message, started_at, completed_at')
      .eq('cron_name', DIGEST_CRON)
      .order('started_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      cronName: DIGEST_CRON,
      reach: {
        opted_in: optedInRes.count ?? 0,
        telegram: telegramRes.count ?? 0,
        email: emailRes.count ?? 0,
        push: pushRes.count ?? 0,
      },
      recentRuns: (runs ?? []).map((r) => {
        const x = r as Record<string, unknown>;
        return {
          id: x.id as string,
          status: (x.status as string) ?? null,
          duration_ms: x.duration_ms == null ? null : Number(x.duration_ms),
          items_processed: x.items_processed == null ? null : Number(x.items_processed),
          error_message: (x.error_message as string) ?? null,
          started_at: (x.started_at as string) ?? null,
          completed_at: (x.completed_at as string) ?? null,
        };
      }),
    });
  } catch (err) {
    console.error('[admin/news-alerts GET] Failed:', err);
    return NextResponse.json({
      cronName: DIGEST_CRON,
      reach: { opted_in: 0, telegram: 0, email: 0, push: 0 },
      recentRuns: [],
    });
  }
}
