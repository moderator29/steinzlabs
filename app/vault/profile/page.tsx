import Link from 'next/link';
import { getCultAccess } from '@/lib/cult/access';
import { MantlePanel } from '@/components/vault/sanctum/MantlePanel';
import { AnnalsPanel } from '@/components/vault/sanctum/AnnalsPanel';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Your Profile — The Vault',
  description: 'Your cult identity, mantle, and annals in one place.',
};

/**
 * Member profile surface — the one place that aggregates a cultist's identity.
 * The vault layout already gates access (non-members are bounced), so here we
 * just resolve the display name and compose the existing, proven Mantle (worn
 * loadout) and Annals (earned achievements) panels rather than re-implement
 * them. This is the member-facing home for everything that "carries forward".
 */
export default async function VaultProfilePage() {
  const access = await getCultAccess();
  const name = access.displayName ?? access.username ?? 'Cultist';

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-5 py-10">
      <Link href="/vault" className="text-[12px] font-semibold text-[#9FB0D8] transition hover:text-white">
        ← Back to the Vault
      </Link>

      <header className="flex items-center gap-4">
        <span className="vault-identity__sigil text-[40px] leading-none" aria-hidden="true">◈</span>
        <div>
          <h1 className="text-[26px] font-bold leading-tight text-white">{name}</h1>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9FB0D8]">
            Cultist · The Vault
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#00C8FF]">Your Mantle</h2>
        <p className="text-[13px] text-[#B4C0E0]">What carries forward when the cult sees you.</p>
        <MantlePanel />
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FFD86B]">The Annals</h2>
        <p className="text-[13px] text-[#B4C0E0]">Every mark you have earned in the cult.</p>
        <AnnalsPanel />
      </section>
    </div>
  );
}
