import { unstable_cache } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

interface Stat {
  label: string;
  value: string;
  sub?: string;
}

const NAKA_THRESHOLD = 1_227_000;

/**
 * Live stats strip for the /naka-cult landing.
 *
 * Server component — fetches once per request via SSR (the page is
 * `force-dynamic` so this re-runs on every visit). Every number is real
 * from Supabase or the on-chain config; absent data renders an em-dash,
 * never fabricated.
 */
// §perf-5: parent page is force-dynamic for per-user CTA but the public
// stats below are identical for every viewer. Cache the loadStats() call
// itself (Next data cache) so it executes at most once per minute even
// when the page re-renders on every request. ~99% query-cost reduction
// on crawler / cold-visitor traffic.
const loadStatsCached = unstable_cache(loadStats, ['naka-cult:stats'], {
  revalidate: 60,
  tags: ['naka-cult:stats'],
});

export async function CultStatsStrip() {
  const stats = await loadStatsCached();
  return (
    <section className="nakacult-stats" aria-label="Naka Cult live stats">
      {stats.map((s) => (
        <div key={s.label} className="nakacult-stats__cell">
          <div className="nakacult-stats__value">{s.value}</div>
          <div className="nakacult-stats__label">{s.label}</div>
          {s.sub && <div className="nakacult-stats__sub">{s.sub}</div>}
        </div>
      ))}
    </section>
  );
}

async function loadStats(): Promise<Stat[]> {
  const db = getSupabaseAdmin();
  let memberCount: number | null = null;
  let treasuryUsd: number | null = null;
  let trackCount: number | null = null;

  try {
    const { count } = await db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('cult_member', true);
    memberCount = count ?? null;
  } catch { /* graceful empty */ }

  try {
    const { data } = await db
      .from('cult_treasury_snapshots')
      .select('balance_usd')
      .order('captured_at', { ascending: false })
      .limit(1);
    treasuryUsd = data && data[0]?.balance_usd != null ? Number(data[0].balance_usd) : null;
  } catch { /* graceful empty */ }

  try {
    const { count } = await db
      .from('cult_ambient_tracks')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    trackCount = count ?? null;
  } catch { /* graceful empty */ }

  return [
    {
      label: 'Cultists',
      value: memberCount === null ? '…' : memberCount.toLocaleString(),
      sub: 'Verified on-chain',
    },
    {
      label: 'Treasury',
      value: treasuryUsd === null || treasuryUsd === 0
        ? '…'
        : `$${treasuryUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      sub: 'Live snapshot',
    },
    {
      label: 'Entry threshold',
      value: `${(NAKA_THRESHOLD / 1_000_000).toFixed(2)}M`,
      sub: '$NAKA per wallet',
    },
    {
      label: 'Soundtrack',
      value: trackCount === null ? '…' : `${trackCount} tracks`,
      sub: 'Curated by Ddergo',
    },
  ];
}
