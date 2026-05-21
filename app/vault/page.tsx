import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { ChamberPortal } from '@/components/vault/ChamberPortal';
import { CultStatsCounter } from '@/components/vault/CultStatsCounter';
import { ConclaveSigil } from '@/components/vault/sigils/ConclaveSigil';
import { OracleSigil } from '@/components/vault/sigils/OracleSigil';
import { SanctumSigil } from '@/components/vault/sigils/SanctumSigil';
import { VaultEntryGateway } from './VaultEntryGateway';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'The Vault — Naka Labs',
  description: 'Three sealed chambers: the Conclave, the Oracle, the Sanctum.',
};

interface CultStatsRow {
  active_members: number | null;
  chosen_count: number | null;
  total_naka_held: string | null;
  decrees_passed: number | null;
}

async function loadCultStats(): Promise<CultStatsRow | null> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from('cult_stats').select('*').maybeSingle<CultStatsRow>();
    return data ?? null;
  } catch {
    return null;
  }
}

// §vault-server-client-function-prop — `compactNumber` used to be passed
// as a `format` prop to <CultStatsCounter />. That triggered the App
// Router error "Functions cannot be passed directly to Client
// Components" (Sentry-captured as the real cause of the /vault retry
// loop). Formatter moved into the client component; the page passes a
// serialisable `formatKind: 'compact'` enum instead.

export default async function VaultPage() {
  const stats = await loadCultStats();
  const totalNaka = stats?.total_naka_held ? Number(stats.total_naka_held) : null;

  return (
    <>
      <VaultEntryGateway />

      <section className="mx-auto max-w-6xl px-5 pt-6 pb-3 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B4C0E0]">
          THE VAULT
        </p>
        <h1 className="mt-2 text-[clamp(28px,4vw,44px)] font-bold leading-tight text-white"
            style={{ textShadow: '0 0 40px rgba(0, 153, 255, 0.45)' }}>
          Three sealed chambers.<br />Power. Sight. Soul.
        </h1>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-5 py-10 md:grid-cols-3">
        <ChamberPortal
          href="/vault/conclave"
          name="The Conclave"
          tagline="Power"
          description="Vote on Decrees, hold the treasury, shape the platform."
          sigil={<ConclaveSigil size={88} />}
          comingSoon
        />
        <ChamberPortal
          href="/vault/oracle"
          name="The Oracle"
          tagline="Sight"
          description="Daily Seal briefings, VTX Sage, the Whisper Network, stealth tracking."
          sigil={<OracleSigil size={88} />}
          comingSoon
        />
        <ChamberPortal
          href="/vault/sanctum"
          name="The Sanctum"
          tagline="Soul"
          description="Identity, achievements, lore, music, the cult NFT showcase."
          sigil={<SanctumSigil size={88} />}
          comingSoon
        />
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B4C0E0]">
          THE CULT IS ALIVE
        </p>
        <CultStatsCounter
          stats={[
            { label: 'Active Cultists', value: stats?.active_members ?? null },
            { label: '$NAKA Held',      value: totalNaka, formatKind: 'compact' },
            { label: 'Decrees Passed',  value: stats?.decrees_passed ?? null },
            { label: 'Chosen Seals',    value: stats?.chosen_count ?? null },
          ]}
        />
      </section>
    </>
  );
}
