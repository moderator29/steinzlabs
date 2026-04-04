import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: Request) {
  try {
    const { secret } = await request.json();
    if (secret !== 'run-migration-195656') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    const { error: tableCheck } = await admin.from('profiles').select('id').limit(1);

    if (tableCheck && tableCheck.message?.includes('does not exist')) {
      return NextResponse.json({
        error: 'Table does not exist. You need to run the SQL in Supabase SQL Editor.',
        needsManualSetup: true
      }, { status: 400 });
    }

    if (!tableCheck) {
      return NextResponse.json({ message: 'profiles table already exists!', success: true });
    }

    return NextResponse.json({
      error: 'Unexpected error: ' + tableCheck.message,
      needsManualSetup: true
    }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
