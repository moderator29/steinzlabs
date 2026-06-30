import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { guardRoute } from '@/lib/api/guardRoute';
import {
  emptyCursor,
  isEvmAddress,
  isSolanaAddress,
  normalizeAddress,
  type SmartAlertType,
} from '@/lib/alerts/smartAlerts';

/**
 * Per-user Smart Alert CRUD backed by public.alerts. This is the single
 * server-side home for the four alert types created on /dashboard/alerts
 * (price, whale, launch, wallet_activity), so they survive tab-close and sync
 * across devices. The alert-monitor cron evaluates these rows against real
 * free data sources (see lib/alerts/smartAlerts.ts).
 *
 * Column shape (live schema):
 *   alert_type text, label text, condition jsonb, triggered boolean,
 *   triggered_at timestamptz, active boolean, created_at timestamptz.
 *
 * The typed user params + monitor cursor live inside condition JSONB so we can
 * add alert types without a migration each time.
 */

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => { /* read-only in route handler */ },
      },
    },
  );
}

// ── Validation ──────────────────────────────────────────────────────────────

const CHAIN = z.enum(['solana', 'ethereum', 'bsc', 'base']);

const PriceParams = z.object({
  type: z.literal('price'),
  label: z.string().min(1).max(140).optional(),
  tokenId: z.string().min(1).max(120),
  tokenSymbol: z.string().min(1).max(40),
  direction: z.enum(['above', 'below']),
  targetPrice: z.number().positive(),
});

const WhaleParams = z.object({
  type: z.literal('whale'),
  label: z.string().min(1).max(140).optional(),
  walletAddress: z.string().min(8).max(120),
  threshold: z.number().positive(),
  chain: CHAIN,
});

const WalletActivityParams = z.object({
  type: z.literal('wallet_activity'),
  label: z.string().min(1).max(140).optional(),
  walletAddress: z.string().min(8).max(120),
  chain: CHAIN,
});

const LaunchParams = z.object({
  type: z.literal('launch'),
  label: z.string().min(1).max(140).optional(),
  minLiquidity: z.number().min(0),
  minHolders: z.number().int().min(0),
  chain: z.enum(['solana', 'any']),
  keywords: z.array(z.string().max(40)).max(10).default([]),
});

const SmartPostBody = z.discriminatedUnion('type', [
  PriceParams, WhaleParams, WalletActivityParams, LaunchParams,
]);

// Legacy shape still used by the older /app/alerts page. Kept working so this
// change stays scoped to the dashboard alerts feature without breaking that
// surface. These rows are stored verbatim under their uppercase alert_type.
const LEGACY_TYPES = ['PRICE', 'VOLUME', 'WHALE', 'ENTITY_MOVEMENT', 'SCAMMER'] as const;
const LegacyPostBody = z.object({
  alert_type: z.enum(LEGACY_TYPES),
  label: z.string().min(1).max(140).optional(),
  condition: z.object({
    token: z.string().min(1).max(120),
    threshold: z.union([z.string(), z.number()]).optional(),
    direction: z.enum(['above', 'below']).optional(),
  }),
});

const PatchBody = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});

// ── Row → API shape ─────────────────────────────────────────────────────────

interface AlertRow {
  id: string;
  alert_type: string;
  label: string;
  condition: Record<string, unknown>;
  triggered: boolean;
  triggered_at: string | null;
  active: boolean;
  created_at: string;
}

// Superset shape: the dashboard page reads `type`/`name`/`triggerCount`, while
// the legacy /app/alerts page reads `alert_type`/`label`. Returning both keeps
// both consumers working off one endpoint.
function toApi(r: AlertRow) {
  const cursor = (r.condition?.cursor ?? {}) as { triggerCount?: number; lastTriggered?: number };
  return {
    id: r.id,
    type: r.alert_type as SmartAlertType,
    alert_type: r.alert_type,
    name: r.label,
    label: r.label,
    active: r.active,
    triggered: r.triggered,
    triggeredAt: r.triggered_at,
    createdAt: r.created_at,
    created_at: r.created_at,
    triggerCount: typeof cursor.triggerCount === 'number' ? cursor.triggerCount : 0,
    lastTriggered: typeof cursor.lastTriggered === 'number' ? cursor.lastTriggered : undefined,
    condition: r.condition,
  };
}

const SELECT = 'id, alert_type, label, condition, triggered, triggered_at, active, created_at';

// ── GET: list the caller's smart alerts ─────────────────────────────────────

export async function GET() {
  const supabase = await getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('alerts')
    .select(SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alerts: (data ?? []).map((r) => toApi(r as AlertRow)) });
}

// ── POST: create a smart alert ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const guard = await guardRoute(request, { rate: 'med' });
  if (!guard.ok) return guard.response;
  const supabase = await getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rawBody = await request.json().catch(() => null);

  // Legacy /app/alerts page sends { alert_type: 'PRICE'|… , condition: {token…} }.
  // Preserve that contract verbatim so this dashboard change stays scoped.
  if (rawBody && typeof rawBody === 'object' && 'alert_type' in rawBody && !('type' in rawBody)) {
    const legacy = LegacyPostBody.safeParse(rawBody);
    if (!legacy.success) {
      return NextResponse.json({ error: 'Invalid payload', details: legacy.error.issues }, { status: 400 });
    }
    const label = legacy.data.label ?? `${legacy.data.alert_type} ${legacy.data.condition.token}`;
    const { data, error } = await supabase
      .from('alerts')
      .insert({
        user_id: user.id,
        alert_type: legacy.data.alert_type,
        label,
        condition: legacy.data.condition,
        active: true,
      })
      .select(SELECT)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ alert: toApi(data as AlertRow) });
  }

  const parsed = SmartPostBody.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
  }
  const body = parsed.data;

  // Build the typed condition + monitor cursor. Addresses are validated and
  // normalized via addressNormalize (never raw .toLowerCase()), and we reject
  // wallets that aren't a recognizable EVM or Solana address for the chosen
  // chain so the monitor never burns API budget on garbage.
  let label: string;
  let condition: Record<string, unknown>;

  switch (body.type) {
    case 'price': {
      label = body.label || `${body.tokenSymbol.toUpperCase()} ${body.direction} $${body.targetPrice.toLocaleString()}`;
      condition = {
        type: 'price',
        tokenId: body.tokenId,
        tokenSymbol: body.tokenSymbol,
        direction: body.direction,
        targetPrice: body.targetPrice,
        cursor: emptyCursor(),
      };
      break;
    }
    case 'whale':
    case 'wallet_activity': {
      const raw = body.walletAddress.trim();
      const isEvm = isEvmAddress(raw);
      const isSol = isSolanaAddress(raw);
      if (body.chain === 'solana' && !isSol) {
        return NextResponse.json({ error: 'Invalid Solana wallet address' }, { status: 400 });
      }
      if (body.chain !== 'solana' && !isEvm) {
        return NextResponse.json({ error: 'Invalid EVM wallet address' }, { status: 400 });
      }
      const walletAddress = normalizeAddress(raw, body.chain);
      const short = `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`;
      if (body.type === 'whale') {
        label = body.label || `Whale Watch · ${short}`;
        condition = { type: 'whale', walletAddress, threshold: body.threshold, chain: body.chain, cursor: emptyCursor() };
      } else {
        label = body.label || `Activity · ${short}`;
        condition = { type: 'wallet_activity', walletAddress, chain: body.chain, cursor: emptyCursor() };
      }
      break;
    }
    case 'launch': {
      label = body.label || `New launch over $${body.minLiquidity.toLocaleString()} liquidity`;
      condition = {
        type: 'launch',
        minLiquidity: body.minLiquidity,
        minHolders: body.minHolders,
        chain: body.chain,
        keywords: body.keywords,
        cursor: emptyCursor(),
      };
      break;
    }
  }

  const { data, error } = await supabase
    .from('alerts')
    .insert({
      user_id: user.id,
      alert_type: body.type,
      label,
      condition,
      active: true,
      triggered: false,
    })
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alert: toApi(data as AlertRow) });
}

// ── PATCH: pause / resume a smart alert ─────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const guard = await guardRoute(request, { rate: 'med' });
  if (!guard.ok) return guard.response;
  const supabase = await getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = PatchBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { data, error } = await supabase
    .from('alerts')
    .update({ active: parsed.data.active })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alert: toApi(data as AlertRow) });
}

// ── DELETE: remove a smart alert ────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const guard = await guardRoute(request, { rate: 'med' });
  if (!guard.ok) return guard.response;
  const supabase = await getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  const { error } = await supabase
    .from('alerts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
