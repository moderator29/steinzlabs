import { NextRequest, NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const SLOTS = ['avatar', 'frame', 'glow', 'banner', 'title', 'sigil'] as const;
type Slot = (typeof SLOTS)[number];

interface EquipPayload {
  slot?: unknown;
  cosmetic_id?: unknown;
}

/**
 * GET /api/cult/sanctum/mantle — catalog of cosmetics + caller's loadout.
 *
 * Catalog is filtered to active rows. Loadout is keyed by slot so the UI
 * can render six rows even when nothing is equipped yet.
 */
export async function GET(_req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const [{ data: cosmetics }, { data: loadout }, { data: earned }] = await Promise.all([
    admin
      .from('cult_cosmetics')
      .select('id,slot,code,label,asset_url,preview_color,requires_achievement_code')
      .eq('active', true)
      .order('slot', { ascending: true })
      .order('created_at', { ascending: true }),
    admin
      .from('cult_member_loadouts')
      .select('slot,cosmetic_id,equipped_at')
      .eq('user_id', access.userId),
    // For requires_achievement_code lookups: get the user's earned codes.
    admin
      .from('cult_member_achievements')
      .select('achievement_id, cult_achievements!inner(code)')
      .eq('user_id', access.userId),
  ]);

  const earnedCodes = new Set(
    ((earned ?? []) as Array<{ cult_achievements: { code: string } | { code: string }[] }>).flatMap(
      (row) => {
        const ach = row.cult_achievements;
        if (!ach) return [];
        return Array.isArray(ach) ? ach.map((a) => a.code) : [ach.code];
      },
    ),
  );

  return NextResponse.json({
    slots: SLOTS,
    cosmetics: cosmetics ?? [],
    loadout: loadout ?? [],
    earnedAchievementCodes: Array.from(earnedCodes),
  });
}

/**
 * POST — equip a cosmetic into a slot for the caller.
 *
 * Idempotent: upserts the (user_id, slot) row. Validates the cosmetic's
 * slot matches the requested slot so the client can't shove an avatar
 * into the glow slot, and gates on requires_achievement_code when set.
 */
export async function POST(req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let payload: EquipPayload;
  try {
    payload = (await req.json()) as EquipPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const slot = typeof payload.slot === 'string' ? (payload.slot as Slot) : null;
  const cosmeticId = typeof payload.cosmetic_id === 'string' ? payload.cosmetic_id : '';
  if (!slot || !SLOTS.includes(slot)) {
    return NextResponse.json({ error: 'invalid_slot' }, { status: 400 });
  }
  if (!cosmeticId) return NextResponse.json({ error: 'cosmetic_id_required' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data: cosmetic } = await admin
    .from('cult_cosmetics')
    .select('id,slot,active,requires_achievement_code')
    .eq('id', cosmeticId)
    .maybeSingle<{
      id: string;
      slot: Slot;
      active: boolean;
      requires_achievement_code: string | null;
    }>();
  if (!cosmetic) return NextResponse.json({ error: 'cosmetic_not_found' }, { status: 404 });
  if (!cosmetic.active) return NextResponse.json({ error: 'cosmetic_inactive' }, { status: 410 });
  if (cosmetic.slot !== slot) {
    return NextResponse.json({ error: 'slot_mismatch' }, { status: 400 });
  }

  if (cosmetic.requires_achievement_code) {
    const { data: gate } = await admin
      .from('cult_member_achievements')
      .select('achievement_id, cult_achievements!inner(code)')
      .eq('user_id', access.userId)
      .eq('cult_achievements.code', cosmetic.requires_achievement_code)
      .limit(1);
    if (!gate || gate.length === 0) {
      return NextResponse.json(
        { error: 'achievement_required', code: cosmetic.requires_achievement_code },
        { status: 403 },
      );
    }
  }

  const { error: upsertErr } = await admin
    .from('cult_member_loadouts')
    .upsert(
      {
        user_id: access.userId,
        slot,
        cosmetic_id: cosmeticId,
        equipped_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,slot' },
    );

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  return NextResponse.json({ equipped: { slot, cosmetic_id: cosmeticId } });
}
