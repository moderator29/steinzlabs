import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 30;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

interface Stats {
  tokensAnalyzed: number;
  rugsDetected: number;
  swapsProtected: number;
  chainsSupported: number;
}

const DEFAULTS: Stats = {
  tokensAnalyzed: 0,
  rugsDetected: 0,
  swapsProtected: 0,
  chainsSupported: 7,
};

export async function GET() {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return NextResponse.json(DEFAULTS, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
    });
  }
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from('platform_stats')
      .select('tokens_analyzed, rugs_detected, swaps_protected, chains_supported')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) {
      // Table missing or not yet seeded — return zeros. Landing page treats
      // zero as a legitimate starting point, not an error.
      return NextResponse.json(DEFAULTS, {
        headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
      });
    }
    const out: Stats = {
      tokensAnalyzed: Number(data.tokens_analyzed) || 0,
      rugsDetected: Number(data.rugs_detected) || 0,
      swapsProtected: Number(data.swaps_protected) || 0,
      chainsSupported: Number(data.chains_supported) || 7,
    };
    return NextResponse.json(out, {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60' },
    });
  } catch (err) {
    console.error('[landing-stats]', err);
    return NextResponse.json(DEFAULTS);
  }
}
