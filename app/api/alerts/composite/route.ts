import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { checkAlertLimit } from '@/lib/notifications/tierLimits';

/**
 * §3 P2-F.1 + P2-F.2 + P2-F.5
 *
 * POST  body { name, expression, cooldown_seconds? }
 *   Creates a composite alert. Validates the expression tree shape
 *   (op AND/OR + recognized predicate types), checks tier limits,
 *   and inserts into composite_alerts.
 *
 * GET   → list of the caller's composite alerts.
 *
 * The expression tree IS the user-defined query DSL (P2-F.5): JSON
 * with nested AND/OR + leaf predicates. A query-builder UI on the
 * client emits this same JSON.
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
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );
}

const VALID_OPS = new Set(['AND', 'OR']);
const VALID_PREDICATE_TYPES = new Set([
  'price', 'velocity', 'whale_buy', 'whale_action',
  'market_cap_below', 'market_cap_above', 'deployer_band',
]);

interface ExpressionNode {
  op?: string;
  children?: ExpressionNode[];
  type?: string;
  [k: string]: unknown;
}

function validateExpression(node: unknown, depth = 0): string | null {
  if (depth > 4) return 'expression too deeply nested (max 4 levels)';
  if (!node || typeof node !== 'object') return 'expression must be an object';
  const n = node as ExpressionNode;
  if (n.op) {
    if (!VALID_OPS.has(n.op)) return `unknown op: ${n.op}`;
    if (!Array.isArray(n.children) || n.children.length === 0) return 'op node must have children[]';
    for (const c of n.children) {
      const err = validateExpression(c, depth + 1);
      if (err) return err;
    }
    return null;
  }
  if (n.type) {
    if (!VALID_PREDICATE_TYPES.has(n.type)) return `unknown predicate type: ${n.type}`;
    return null;
  }
  return 'node must have either op or type';
}

export async function GET() {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await sb
    .from('composite_alerts')
    .select('id, name, expression, cooldown_seconds, active, last_triggered_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  return NextResponse.json({ alerts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { name?: string; expression?: unknown; cooldown_seconds?: number };
  if (!body.name || typeof body.name !== 'string' || body.name.length > 120) {
    return NextResponse.json({ error: 'name required (max 120 chars)' }, { status: 400 });
  }
  const err = validateExpression(body.expression);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const tierCheck = await checkAlertLimit(user.id);
  if (!tierCheck.allowed) {
    return NextResponse.json({
      error: `Alert limit reached (${tierCheck.current}/${tierCheck.limit} on ${tierCheck.tier} tier)`,
      tier_check: tierCheck,
    }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('composite_alerts')
    .insert({
      user_id: user.id,
      name: body.name,
      expression: body.expression,
      cooldown_seconds: Math.max(30, Math.min(86400, body.cooldown_seconds ?? 300)),
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: (data as { id: string }).id });
}
