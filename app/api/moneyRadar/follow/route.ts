import { NextRequest, NextResponse } from 'next/server';
import { arkhamAPI } from '@/lib/arkham/api';
import { getUserByWallet } from '@/lib/database/supabase';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { userWallet, entityId } = await request.json();

    if (!userWallet || !entityId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const user = await getUserByWallet(userWallet);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const entity = await arkhamAPI.getEntity(entityId);

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('followed_entities')
      .upsert({
        user_id: user.id,
        entity_id: entityId,
        entity_name: entity.name,
        entity_type: entity.type,
        wallets: entity.addresses || [],
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Now following ${entity.name}`,
      entity: data,
    });
  } catch (error: any) {
    console.error('Follow entity failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to follow entity' },
      { status: 500 }
    );
  }
}
