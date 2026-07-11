import 'server-only';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Returns the authenticated user's built-in (Naka) wallet address from
// user_wallets, so a wallet created on another device/session is detected
// even when this browser's localStorage is empty. This is what stops the
// "connect a wallet" re-prompt on the portfolio / swap / VTX surfaces when the
// account genuinely already has an active wallet. Only the PUBLIC address is
// returned; the encrypted private key never leaves the server.
export async function GET() {
  try {
    const cookieStore = await cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (n: string) => cookieStore.get(n)?.value, set() {}, remove() {} } },
    );
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ address: null });

    const db = getSupabaseAdmin();
    // Prefer the default wallet, else the most recently created one.
    const { data } = await db
      .from('user_wallets')
      .select('wallet_address, chain, is_default, created_at')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      address: data?.wallet_address ?? null,
      chain: data?.chain ?? null,
    });
  } catch {
    return NextResponse.json({ address: null });
  }
}
