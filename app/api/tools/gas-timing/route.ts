import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Smart Gas Timing — learns cheap-hour patterns from REAL sampled gas prices
// (gas_samples, populated by the gas-sample cron). Returns current gas, the
// average gas by hour-of-day (UTC), the cheapest hours, and whether now is a
// good time. Honest: "collecting" state until enough samples exist.
export async function GET(req: NextRequest) {
  const chain = (req.nextUrl.searchParams.get('chain') || 'ethereum').toLowerCase();
  try {
    const admin = getSupabaseAdmin();
    const since = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
    const { data, error } = await admin
      .from('gas_samples')
      .select('gas_gwei, sampled_at')
      .eq('chain', chain)
      .gte('sampled_at', since)
      .order('sampled_at', { ascending: false })
      .limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });

    const rows = (data ?? []) as Array<{ gas_gwei: number; sampled_at: string }>;
    const current = rows.length ? rows[0].gas_gwei : null;

    // Average by hour-of-day (UTC).
    const buckets = new Map<number, { sum: number; n: number }>();
    for (const r of rows) {
      const h = new Date(r.sampled_at).getUTCHours();
      const b = buckets.get(h) ?? { sum: 0, n: 0 };
      b.sum += Number(r.gas_gwei); b.n += 1;
      buckets.set(h, b);
    }
    const hourly = Array.from({ length: 24 }, (_, h) => {
      const b = buckets.get(h);
      return { hourUtc: h, avgGwei: b ? Number((b.sum / b.n).toFixed(2)) : null, samples: b?.n ?? 0 };
    });
    const withData = hourly.filter((h) => h.avgGwei != null) as Array<{ hourUtc: number; avgGwei: number; samples: number }>;
    const enoughData = rows.length >= 48 && withData.length >= 6;

    let cheapestHours: number[] = [];
    let recommendation: 'now-is-good' | 'wait' | 'collecting' = 'collecting';
    if (enoughData) {
      const sorted = withData.slice().sort((a, b) => a.avgGwei - b.avgGwei);
      cheapestHours = sorted.slice(0, 4).map((h) => h.hourUtc).sort((a, b) => a - b);
      const overallAvg = withData.reduce((s, h) => s + h.avgGwei, 0) / withData.length;
      recommendation = current != null && current <= overallAvg * 0.9 ? 'now-is-good' : 'wait';
    }

    return NextResponse.json({
      chain, currentGwei: current, hourly, cheapestHoursUtc: cheapestHours,
      recommendation, sampleCount: rows.length,
    }, { headers: { 'Cache-Control': 'public, s-maxage=60' } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 502 });
  }
}
