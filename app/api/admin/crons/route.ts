import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/adminAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * ADM3: list every cron with its last N executions, last status,
 * average duration, and pause-state read from feature_flags
 * (key='cron.<name>.paused').
 */

export const runtime = 'nodejs';

interface CronSummary {
  name: string;
  lastStatus: 'success' | 'failed' | 'timeout' | null;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  successRate24h: number;
  runs24h: number;
  paused: boolean;
}

export async function GET(request: NextRequest) {
  const ctx = await requirePermission(request, 'admin.read');
  if (ctx instanceof Response) return ctx;

  const supabase = getSupabaseAdmin();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Pull the last 24h of cron executions; aggregate in JS so we can
  // keep the route schema-free of any DB-side view.
  const { data: rows } = await supabase
    .from('cron_execution_log')
    .select('cron_name, status, duration_ms, started_at')
    .gt('started_at', since24h)
    .order('started_at', { ascending: false })
    .limit(5000);

  type Row = { cron_name: string; status: string; duration_ms: number | null; started_at: string };
  const grouped = new Map<string, Row[]>();
  for (const r of (rows ?? []) as Row[]) {
    const arr = grouped.get(r.cron_name) ?? [];
    arr.push(r);
    grouped.set(r.cron_name, arr);
  }

  // Pause-state flags live in feature_flags with key 'cron.<name>.paused'.
  const { data: flags } = await supabase
    .from('feature_flags')
    .select('key, enabled')
    .like('key', 'cron.%.paused');
  const paused = new Set(
    (flags ?? []).filter((f) => f.enabled).map((f) => f.key.replace(/^cron\.|\.paused$/g, '')),
  );

  const summaries: CronSummary[] = [];
  for (const [name, runs] of grouped) {
    const successes = runs.filter((r) => r.status === 'success').length;
    summaries.push({
      name,
      lastStatus: (runs[0]?.status as CronSummary['lastStatus']) ?? null,
      lastRunAt: runs[0]?.started_at ?? null,
      lastDurationMs: runs[0]?.duration_ms ?? null,
      successRate24h: runs.length === 0 ? 0 : Math.round((successes / runs.length) * 100),
      runs24h: runs.length,
      paused: paused.has(name),
    });
  }
  summaries.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ crons: summaries });
}

export async function POST(request: NextRequest) {
  const ctx = await requirePermission(request, 'cron.trigger');
  if (ctx instanceof Response) return ctx;

  const body = await request.json().catch(() => null) as { action?: 'pause' | 'resume'; name?: string } | null;
  if (!body?.name || (body.action !== 'pause' && body.action !== 'resume')) {
    return NextResponse.json({ error: 'name + action=pause|resume required' }, { status: 400 });
  }

  const key = `cron.${body.name}.paused`;
  const supabase = getSupabaseAdmin();
  const { data: before } = await supabase
    .from('feature_flags')
    .select('enabled')
    .eq('key', key)
    .maybeSingle<{ enabled: boolean }>();

  await supabase.from('feature_flags').upsert({
    key,
    enabled: body.action === 'pause',
    description: `Pause switch for /api/cron/${body.name}`,
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  const { logAdminAction } = await import('@/lib/auth/adminAuth');
  await logAdminAction(ctx, {
    action: `cron.${body.action}`,
    target_type: 'cron',
    target_id: body.name,
    before_state: { paused: before?.enabled ?? false },
    after_state: { paused: body.action === 'pause' },
  });

  return NextResponse.json({ ok: true });
}
