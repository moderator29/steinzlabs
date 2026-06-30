import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';
import { logAdminAction } from '@/lib/admin/auditLog';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

/**
 * Admin wallet labels — curated address labels live on the canonical `whales`
 * table (label + entity_type), discriminated by manual_label=true, so labels an
 * admin sets actually surface in the feed/directory/clusters (which all read
 * whales). Replaces the old, write-only whale_addresses registry that nothing
 * read. `category` maps to whales.entity_type. Manual rows are is_active=false
 * so a bare label doesn't appear in the tracked-whale directory.
 */

const CreateBody = z.object({
  address: z.string().min(8).max(128),
  chain: z.string().min(2).max(32),
  label: z.string().min(1).max(120),
  category: z.string().min(1).max(64),
  verified: z.boolean().optional(),
});

const PatchBody = z.object({
  label: z.string().min(1).max(120).optional(),
  category: z.string().min(1).max(64).optional(),
  verified: z.boolean().optional(),
}).strict();

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('whales')
      .select('id, address, chain, label, entity_type, verified, updated_at')
      .eq('manual_label', true)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[admin/wallet-labels GET] Query error:', error);
      return NextResponse.json({ labels: [] });
    }
    // Surface entity_type as `category` for the existing UI contract.
    const labels = (data ?? []).map((r) => ({
      id: r.id, address: r.address, chain: r.chain, label: r.label,
      category: r.entity_type, verified: r.verified, updated_at: r.updated_at,
    }));
    return NextResponse.json({ labels });
  } catch (err) {
    console.error('[admin/wallet-labels GET] Failed:', err);
    return NextResponse.json({ labels: [] });
  }
}

export async function POST(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const raw = await request.json().catch(() => null);
    const parsed = CreateBody.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.issues }, { status: 400 });
    }
    const body = parsed.data;
    const supabase = getSupabaseAdmin();
    // Upsert onto the canonical entity row (address,chain unique). If the whale
    // is already tracked we only stamp the label fields; a label-only address
    // lands as is_active=false so it isn't listed as a tracked whale.
    const { data, error } = await supabase
      .from('whales')
      .upsert({
        address: normalizeAddress(body.address, body.chain),
        chain: body.chain,
        label: body.label,
        entity_type: body.category,
        verified: body.verified ?? false,
        manual_label: true,
        is_active: false,
      }, { onConflict: 'address,chain' })
      .select('id, address, chain, label, entity_type, verified')
      .single();

    if (error) {
      console.error('[admin/wallet-labels POST] Upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void logAdminAction({ adminId, action: 'wallet_label_set', details: { id: data?.id, address: body.address, chain: body.chain, label: body.label, category: body.category } });
    return NextResponse.json({ label: { ...data, category: data?.entity_type } });
  } catch (err) {
    console.error('[admin/wallet-labels POST] Failed:', err);
    return NextResponse.json({ error: 'Failed to create label' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const raw = await request.json().catch(() => null);
    const parsed = PatchBody.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.issues }, { status: 400 });
    }
    const body = parsed.data;
    const update: Record<string, unknown> = {};
    if (body.label !== undefined) update.label = body.label;
    if (body.category !== undefined) update.entity_type = body.category;
    if (body.verified !== undefined) update.verified = body.verified;
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No updatable fields' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('whales').update(update).eq('id', id);

    if (error) {
      console.error('[admin/wallet-labels PATCH] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void logAdminAction({ adminId, action: 'wallet_label_set', details: { id, fields: Object.keys(update) } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/wallet-labels PATCH] Failed:', err);
    return NextResponse.json({ error: 'Failed to update label' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    // Clear the curated label rather than delete the entity row — the address
    // may also be a tracked analytics whale whose metrics we must not destroy.
    const { error } = await supabase
      .from('whales')
      .update({ label: null, manual_label: false, verified: false })
      .eq('id', id);

    if (error) {
      console.error('[admin/wallet-labels DELETE] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void logAdminAction({ adminId, action: 'wallet_label_clear', details: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/wallet-labels DELETE] Failed:', err);
    return NextResponse.json({ error: 'Failed to delete label' }, { status: 500 });
  }
}
