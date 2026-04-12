import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const walletSchema = z.string().trim().min(1).max(100);

export async function GET(request: NextRequest) {
  try {
    const walletParam = request.nextUrl.searchParams.get('wallet');
    const parsed = walletSchema.safeParse(walletParam);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Valid wallet parameter is required' },
        { status: 400 }
      );
    }

    const walletAddress = parsed.data;
    const admin = getSupabaseAdmin();
    const { data: threats } = await admin
      .from('threats')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(50);

    return NextResponse.json({ threats: threats ?? [] });
  } catch (error) {

    return NextResponse.json(
      { error: 'Failed to fetch threats' },
      { status: 500 }
    );
  }
}
