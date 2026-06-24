import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * OV3: dashboard widget order persistence. Lives inside
 * user_preferences.preferences as a JSON array of widget slugs so no
 * separate column / migration is required. The dashboard reads this on
 * mount and renders widgets in the saved order; a follow-up branch
 * wires the drag-drop UI (HTML5 native, no react-beautiful-dnd dep —
 * the abandoned library isn't worth carrying for this).
 */

export const runtime = 'nodejs';

// §14 — MUST mirror the slugs in lib/dashboard/widgetRegistry.tsx (the
// single render source of truth). It had drifted to a stale set
// (markets/gainers/heating/context-feed/top-gainers) that no longer
// matched the registry's `personalized-home`, so the Customise PATCH
// rejected the real payload with a 400 and reordering never persisted.
const VALID_WIDGETS = ['hero', 'digest', 'personalized-home'] as const;
type Widget = typeof VALID_WIDGETS[number];

// Stored shape evolves from string[] (Session U) to { order, hidden }
// to support show/hide per widget. Reads accept either shape; writes
// always emit the new object form.
interface StoredWidgets {
  order: Widget[];
  hidden: Widget[];
}

function isWidget(s: unknown): s is Widget {
  return typeof s === 'string' && (VALID_WIDGETS as readonly string[]).includes(s);
}

function normaliseStored(raw: unknown): StoredWidgets {
  if (Array.isArray(raw)) {
    return { order: raw.filter(isWidget), hidden: [] };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as { order?: unknown; hidden?: unknown };
    const order = Array.isArray(obj.order) ? obj.order.filter(isWidget) : [];
    const hidden = Array.isArray(obj.hidden) ? obj.hidden.filter(isWidget) : [];
    return { order, hidden };
  }
  return { order: [], hidden: [] };
}

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

export async function GET(_req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('user_preferences')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle<{ preferences: { dashboard_widgets?: unknown } | null }>();

  const normalised = normaliseStored(data?.preferences?.dashboard_widgets);

  return NextResponse.json({
    // `widgets` kept for backward compat with any client still reading
    // the flat array shape; `order` + `hidden` are the new canonical fields.
    widgets: normalised.order,
    order: normalised.order,
    hidden: normalised.hidden,
    supported: VALID_WIDGETS,
  });
}

const PatchBody = z.union([
  // Legacy: flat array of slugs (order only, hidden defaults to []).
  z.object({ widgets: z.array(z.enum(VALID_WIDGETS)).max(20) }),
  // New: explicit order + hidden lists.
  z.object({
    order: z.array(z.enum(VALID_WIDGETS)).max(20),
    hidden: z.array(z.enum(VALID_WIDGETS)).max(20).optional(),
  }),
]);

export async function PATCH(req: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.issues }, { status: 400 });
  }

  const incoming: StoredWidgets = 'widgets' in parsed.data
    ? { order: parsed.data.widgets as Widget[], hidden: [] }
    : { order: parsed.data.order as Widget[], hidden: (parsed.data.hidden ?? []) as Widget[] };

  const admin = getSupabaseAdmin();
  // Read-modify-write so we don't clobber any other keys in the
  // preferences blob (muted_feed_sources from Branch 19 etc).
  const { data: row } = await admin
    .from('user_preferences')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle<{ preferences: Record<string, unknown> | null }>();
  const next = { ...(row?.preferences ?? {}), dashboard_widgets: incoming };

  const { error } = await admin
    .from('user_preferences')
    .upsert({ user_id: user.id, preferences: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, order: incoming.order, hidden: incoming.hidden });
}
