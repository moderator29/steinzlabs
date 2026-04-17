import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Notification ID required' }, { status: 400 });
  }

  // If it's a Supabase-backed notification, mark it in Supabase
  if (id.startsWith('sb-')) {
    const supabaseId = id.replace('sb-', '');
    try {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
      if (serviceKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceKey,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );
        const { error } = await adminClient
          .from('notifications')
          .update({ read: true })
          .eq('id', supabaseId);

        if (error) {

        }
      }
    } catch (err) {

    }
  }

  // localStorage read state is managed client-side via steinz_read_notifs
  return NextResponse.json({ success: true, id });
}
