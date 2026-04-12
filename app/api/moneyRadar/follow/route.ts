import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getEntity } from '@/lib/services/arkham';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { userWallet, entityId } = await request.json() as { userWallet?: string; entityId?: string };
    if (!userWallet || !entityId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const entity = await getEntity(entityId);
    if (!entity) {
      return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    // Lookup user by wallet address
    const { data: user } = await supabaseAdmin.from('wallet_profiles').select('user_id').eq('address', userWallet).limit(1).single();
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { data, error } = await supabaseAdmin
      .from('followed_entities')
      .upsert({ user_id: user.user_id, entity_id: entityId, entity_name: entity.name, entity_type: entity.type, wallets: entity.addresses || [] })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, message: `Now following ${entity.name}`, entity: data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to follow entity' }, { status: 500 });
  }
}
