import Link from 'next/link';
import { getCultAccess } from '@/lib/cult/access';
import { HeroSigil } from '@/components/naka-cult/HeroSigil';
import { ConclaveSigil } from '@/components/vault/sigils/ConclaveSigil';
import { OracleSigil } from '@/components/vault/sigils/OracleSigil';
import { SanctumSigil } from '@/components/vault/sigils/SanctumSigil';
import './landing.css';

export const metadata = {
  title: 'Naka Cult — Redefining the Web3 Space',
  description:
    'The Naka Cult is the inner ring of Naka Labs. Three chambers — the Conclave, the Oracle, the Sanctum — for those who hold the sigil.',
};

export const dynamic = 'force-dynamic';

/**
 * /naka-cult — the dramatic cinematic landing.
 *
 * Public page (no gate). If the visitor is already a cult member their
 * primary CTA goes straight to /vault; otherwise it explains how to enter.
 *
 * This is the proper redirect target for non-cult denied users from the
 * Vault layout (replacing the /dashboard?denied=cult fallback). The redirect
 * itself is updated in the vault layout in this same branch.
 */
export default async function NakaCultLanding() {
  const access = await getCultAccess();
  const isMember = access.allowed;

  return (
    <div className="nakacult-shell">
      {/* ─── HERO ─────────────────────────────────────────────────── */}
      <section className="nakacult-hero">
        <div className="nakacult-hero__sigil">
          <HeroSigil size={210} />
        </div>
        {isMember && <span className="nakacult-status">◈ You are of the Cult</span>}
        <p className="nakacult-hero__eyebrow">The Naka Cult</p>
        <h1 className="nakacult-hero__title">
          Redefining the Web3 space
        </h1>
        <p className="nakacult-hero__tagline">
          The inner ring of Naka Labs. Three chambers, one sigil. Held by those who watched before the noise.
        </p>
        <div className="nakacult-hero__ctas">
          {isMember ? (
            <>
              <Link href="/vault" className="nakacult-cta">Enter the Vault →</Link>
              <a href="#chambers" className="nakacult-cta nakacult-cta--ghost">See the chambers</a>
            </>
          ) : (
            <>
              <a href="#enter" className="nakacult-cta">How to enter →</a>
              <a href="#chambers" className="nakacult-cta nakacult-cta--ghost">See the chambers</a>
            </>
          )}
        </div>
      </section>

      {/* ─── CHAMBERS ─────────────────────────────────────────────── */}
      <section id="chambers" className="nakacult-section">
        <p className="nakacult-section__eyebrow">Three chambers</p>
        <h2 className="nakacult-section__title">Inside the Vault</h2>
        <p className="nakacult-section__sub">
          Each chamber is its own ritual. Members move between them as one — the cult speaks first, then the world hears.
        </p>

        <div className="nakacult-pillars">
          <article className="nakacult-pillar">
            <div className="nakacult-pillar__sigil"><ConclaveSigil size={72} /></div>
            <span className="nakacult-pillar__tagline">The launch</span>
            <h3 className="nakacult-pillar__name">The Conclave</h3>
            <p className="nakacult-pillar__desc">
              Governance. Members author Decrees, raise Whispers, vote with weight. Treasury surfaces in real-time. The cult sets its own course.
            </p>
          </article>

          <article className="nakacult-pillar">
            <div className="nakacult-pillar__sigil"><OracleSigil size={72} /></div>
            <span className="nakacult-pillar__tagline">The sight</span>
            <h3 className="nakacult-pillar__name">The Oracle</h3>
            <p className="nakacult-pillar__desc">
              The Daily Seal — a morning briefing only the cult opens. The Sage. The Whisper Network. Signal moves through the cult before the noise.
            </p>
          </article>

          <article className="nakacult-pillar">
            <div className="nakacult-pillar__sigil"><SanctumSigil size={72} /></div>
            <span className="nakacult-pillar__tagline">The soul</span>
            <h3 className="nakacult-pillar__name">The Sanctum</h3>
            <p className="nakacult-pillar__desc">
              Identity. The Mantle to wear. The Annals to write into. The Library — Ddergo&apos;s sound. The Forge to display the sigils you hold.
            </p>
          </article>
        </div>
      </section>

      {/* ─── ENTRY ────────────────────────────────────────────────── */}
      <section id="enter" className="nakacult-section">
        <p className="nakacult-section__eyebrow">How to enter</p>
        <h2 className="nakacult-section__title">Three paths into the cult</h2>
        <p className="nakacult-section__sub">
          The cult cannot be bought, only held. Three paths recognize you. Each path is verified on-chain and unlocks the same Vault.
        </p>

        <div className="nakacult-entries">
          <article className="nakacult-entry">
            <div className="nakacult-entry__head">
              <span className="nakacult-entry__num">1</span>
              <h3 className="nakacult-entry__title">Hold ≥ 1,227,000 $NAKA</h3>
            </div>
            <p className="nakacult-entry__body">
              Direct on-chain holding. The on-chain resolver verifies your wallet daily and grants Cultist tier automatically.
            </p>
          </article>

          <article className="nakacult-entry">
            <div className="nakacult-entry__head">
              <span className="nakacult-entry__num">2</span>
              <h3 className="nakacult-entry__title">Hold the Loyalty Gem NFT</h3>
            </div>
            <p className="nakacult-entry__body">
              The $27 mint. A perpetual key. Mints when the cult opens its doors — supply is small by design.
            </p>
          </article>

          <article className="nakacult-entry">
            <div className="nakacult-entry__head">
              <span className="nakacult-entry__num">3</span>
              <h3 className="nakacult-entry__title">Hold the Development NFT</h3>
            </div>
            <p className="nakacult-entry__body">
              The $48 mint. Marks you as Chosen — gold trim across the Vault, double vote weight in the Conclave, Elder Chamber access.
            </p>
          </article>
        </div>
      </section>

      {/* ─── FINAL CTA ────────────────────────────────────────────── */}
      <section className="nakacult-final">
        <h2 className="nakacult-final__title">
          {isMember ? 'The Vault remembers you.' : 'The doors open at dawn.'}
        </h2>
        <p className="nakacult-final__sub">
          {isMember
            ? 'Walk in. The chambers are warm. Today’s Seal is waiting.'
            : 'Watch for the next mint, hold the threshold, or carry the Development NFT. The cult will know.'}
        </p>
        {isMember ? (
          <Link href="/vault" className="nakacult-cta">Enter the Vault →</Link>
        ) : (
          <Link href="/dashboard/pricing" className="nakacult-cta">See the path →</Link>
        )}
      </section>
    </div>
  );
}
