import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';
import { logAdminAction } from '@/lib/admin/auditLog';

const CreateBody = z.object({
  address: z.string().min(8).max(128),
  chain: z.string().min(2).max(32),
  label: z.string().min(1).max(120),
  category: z.string().min(1).max(64),
  notes: z.string().max(2_000).nullish(),
  verified: z.boolean().optional(),
});

const PatchBody = z.object({
  address: z.string().min(8).max(128).optional(),
  chain: z.string().min(2).max(32).optional(),
  label: z.string().min(1).max(120).optional(),
  category: z.string().min(1).max(64).optional(),
  notes: z.string().max(2_000).nullish(),
  verified: z.boolean().optional(),
}).strict();

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('whale_addresses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[admin/wallet-labels GET] Query error:', error);
      return NextResponse.json({ labels: [] });
    }

    return NextResponse.json({ labels: data || [] });
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
    const { data, error } = await supabase
      .from('whale_addresses')
      .insert([{
        address: body.address,
        chain: body.chain,
        label: body.label,
        category: body.category,
        notes: body.notes ?? null,
        verified: body.verified ?? false,
      }])
      .select()
      .single();

    if (error) {
      console.error('[admin/wallet-labels POST] Insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void logAdminAction({ adminId, action: 'wallet_label_set', details: { id: data?.id, address: body.address, chain: body.chain, label: body.label, category: body.category } });
    return NextResponse.json({ label: data });
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
    if (Object.keys(body).length === 0) {
      return NextResponse.json({ error: 'No updatable fields' }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('whale_addresses')
      .update(body)
      .eq('id', id);

    if (error) {
      console.error('[admin/wallet-labels PATCH] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void logAdminAction({ adminId, action: 'wallet_label_set', details: { id, fields: Object.keys(body) } });
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
    const { error } = await supabase.from('whale_addresses').delete().eq('id', id);

    if (error) {
      console.error('[admin/wallet-labels DELETE] Delete error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    void logAdminAction({ adminId, action: 'wallet_label_clear', details: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[admin/wallet-labels DELETE] Failed:', err);
    return NextResponse.json({ error: 'Failed to delete label' }, { status: 500 });
  }
}
