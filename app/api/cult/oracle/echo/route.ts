import { NextRequest, NextResponse } from 'next/server';
import { getCultAccess } from '@/lib/cult/access';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { isEvmAddress, isSolanaAddress, normalizeAddress, type Chain } from '@/lib/utils/addressNormalize';

export const runtime = 'nodejs';

interface AddPayload {
  address?: unknown;
  chain?: unknown;
  label?: unknown;
  notes?: unknown;
}

/**
 * GET /api/cult/oracle/echo — Echo Chamber catalog.
 *
 * Returns the active stealth-wallet slots ordered by position. Any cult
 * member may read. Empty array when nothing's been added yet.
 */
export async function GET(_req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('cult_echo_wallets')
    .select('id,position,address,chain,label,notes,added_at')
    .eq('active', true)
    .order('position', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    slots: data ?? [],
    capacity: 25,
  });
}

/**
 * POST /api/cult/oracle/echo — add a wallet to the chamber.
 *
 * Chosen-only. Auto-allocates the next free position (1..25); 25/25 returns 409.
 */
export async function POST(req: NextRequest) {
  const access = await getCultAccess();
  if (!access.allowed || !access.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let payload: AddPayload;
  try {
    payload = (await req.json()) as AddPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const address = typeof payload.address === 'string' ? payload.address.trim() : '';
  const chain = typeof payload.chain === 'string' ? payload.chain.trim().toLowerCase() : '';
  const label = typeof payload.label === 'string' ? payload.label.trim() : '';
  const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';

  if (!address) return NextResponse.json({ error: 'address_required' }, { status: 400 });
  if (!chain) return NextResponse.json({ error: 'chain_required' }, { status: 400 });

  // Address format sanity — Solana stays case-sensitive (addressNormalize
  // helpers already encode the EVM/Solana distinction).
  if (!isEvmAddress(address) && !isSolanaAddress(address)) {
    return NextResponse.json({ error: 'address_format_unknown' }, { status: 400 });
  }
  if (label.length > 80) return NextResponse.json({ error: 'label_too_long' }, { status: 400 });
  if (notes.length > 280) return NextResponse.json({ error: 'notes_too_long' }, { status: 400 });

  const admin = getSupabaseAdmin();

  // Find next free position. The unique partial index on (position) WHERE
  // active=true is the real cap; this scan just picks the smallest gap so
  // re-adds after removals fill in cleanly.
  const { data: used } = await admin
    .from('cult_echo_wallets')
    .select('position')
    .eq('active', true)
    .order('position', { ascending: true });
  const taken = new Set((used ?? []).map((r) => r.position as number));
  let nextPos = -1;
  for (let i = 1; i <= 25; i++) {
    if (!taken.has(i)) {
      nextPos = i;
      break;
    }
  }
  if (nextPos === -1) {
    return NextResponse.json({ error: 'chamber_full', capacity: 25 }, { status: 409 });
  }

  const { data, error } = await admin
    .from('cult_echo_wallets')
    .insert({
      position: nextPos,
      // Normalize per chain — EVM gets lower-cased, Solana stays exact.
      // Storing un-normalized was a CLAUDE.md violation and would have
      // poisoned later equality lookups against user_wallets_v2.
      address: normalizeAddress(address, chain as Chain),
      chain,
      label: label || null,
      notes: notes || null,
      added_by: access.userId,
    })
    .select('id,position,address,chain,label,notes,added_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slot: data }, { status: 201 });
}
