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
export async function CultStatsStrip() {
  const stats = await loadStats();
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
      .eq('tier', 'naka_cult');
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
      value: memberCount === null ? '—' : memberCount.toLocaleString(),
      sub: 'Verified on-chain',
    },
    {
      label: 'Treasury',
      value: treasuryUsd === null || treasuryUsd === 0
        ? '—'
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
      value: trackCount === null ? '—' : `${trackCount} tracks`,
      sub: 'Curated by Ddergo',
    },
  ];
}
