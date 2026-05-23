import Image from 'next/image';
import Link from 'next/link';
import { getCultAccess } from '@/lib/cult/access';
import { ConclaveSigil } from '@/components/vault/sigils/ConclaveSigil';
import { OracleSigil } from '@/components/vault/sigils/OracleSigil';
import { SanctumSigil } from '@/components/vault/sigils/SanctumSigil';
import { CultStatsStrip } from '@/components/naka-cult/CultStatsStrip';
import './landing.css';

export const metadata = {
  title: 'Naka Cult · Redefining the Web3 Space',
  description:
    'The Naka Cult is the inner ring of Naka Labs. Three chambers. One sigil. For those who hold.',
};

// Keep dynamic — per-user CTA (isMember) depends on session cookies via
// getCultAccess(). ISR would cache one user's state to all viewers.
// Stats-strip query cost is mitigated by moving CultStatsStrip data
// fetch behind unstable_cache(60s) instead (see CultStatsStrip.tsx).
export const dynamic = 'force-dynamic';

/**
 * /naka-cult cinematic landing.
 * Public page (no gate). If the visitor is already a cult member their
 * primary CTA goes straight to /vault; otherwise it explains how to enter.
 */
export default async function NakaCultLanding() {
  const access = await getCultAccess();
  const isMember = access.allowed;

  return (
    <div className="nakacult-shell">
      <div className="nakacult-orb-layer" aria-hidden>
        <span className="nakacult-orb nakacult-orb--blue" />
        <span className="nakacult-orb nakacult-orb--crimson" />
        <span className="nakacult-orb nakacult-orb--gold" />
      </div>

      {/* HERO */}
      <section className="nakacult-hero">
        <div className="nakacult-hero__sigil">
          <span className="nakacult-hero__aura" aria-hidden />
          <Image
            src="/branding/naka-go-hero.jpg"
            alt="Naka Go"
            width={420}
            height={420}
            priority
            className="nakacult-hero__logo"
          />
        </div>
        {isMember && <span className="nakacult-status">◈ You are of the Cult</span>}
        <p className="nakacult-hero__eyebrow">The Naka Cult</p>
        <h1 className="nakacult-hero__title">Redefining the Web3 space</h1>
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

      {/* LIVE STATS */}
      <CultStatsStrip />

      {/* CHAMBERS */}
      <section id="chambers" className="nakacult-section">
        <p className="nakacult-section__eyebrow">Three chambers</p>
        <h2 className="nakacult-section__title">Inside the Vault</h2>
        <p className="nakacult-section__sub">
          Each chamber is its own ritual. Members move between them as one. The cult speaks first, then the world hears.
        </p>

        <div className="nakacult-pillars">
          <article className="nakacult-pillar" style={{ animationDelay: '0ms' }}>
            <div className="nakacult-pillar__sigil"><ConclaveSigil size={72} /></div>
            <span className="nakacult-pillar__tagline">The launch</span>
            <h3 className="nakacult-pillar__name">The Conclave</h3>
            <p className="nakacult-pillar__desc">
              Governance built for action. Members author <strong>Decrees</strong>, raise <strong>Whispers</strong>, and vote with weighted sigils. The Conclave moves the treasury and sets the cult&apos;s direction in public.
            </p>
            <ul className="nakacult-pillar__list">
              <li>Decrees, binding proposals</li>
              <li>Whispers, temperature checks</li>
              <li>Treasury panel, real time on chain</li>
              <li>Chosen weight ×2, Development NFT holders</li>
            </ul>
          </article>

          <article className="nakacult-pillar" style={{ animationDelay: '120ms' }}>
            <div className="nakacult-pillar__sigil"><OracleSigil size={72} /></div>
            <span className="nakacult-pillar__tagline">The sight</span>
            <h3 className="nakacult-pillar__name">The Oracle</h3>
            <p className="nakacult-pillar__desc">
              Signal before the crowd. Members read the <strong>Daily Seal</strong> at dawn, query the <strong>Sage</strong> for cult only analysis, and trade tips inside the <strong>Whisper Network</strong>.
            </p>
            <ul className="nakacult-pillar__list">
              <li>Daily Seal, 7am UTC briefing</li>
              <li>The Sage, VTX with cult context</li>
              <li>Whisper Network, encrypted DMs</li>
              <li>Echo Chamber, early calls log</li>
            </ul>
          </article>

          <article className="nakacult-pillar" style={{ animationDelay: '240ms' }}>
            <div className="nakacult-pillar__sigil"><SanctumSigil size={72} /></div>
            <span className="nakacult-pillar__tagline">The soul</span>
            <h3 className="nakacult-pillar__name">The Sanctum</h3>
            <p className="nakacult-pillar__desc">
              Identity made permanent. Choose a <strong>Mantle</strong>, write into the <strong>Annals</strong>, and listen to the <strong>Library</strong>, Ddergo&apos;s curated soundtrack scored for the chamber.
            </p>
            <ul className="nakacult-pillar__list">
              <li>The Mantle, chosen title</li>
              <li>The Annals, your record</li>
              <li>The Library, 8 tracks, ambient</li>
              <li>The Forge, sigil collection</li>
            </ul>
          </article>
        </div>
      </section>

      {/* WHAT MEMBERS GET */}
      <section className="nakacult-section">
        <p className="nakacult-section__eyebrow">Cult only</p>
        <h2 className="nakacult-section__title">Held by sigil, not subscription</h2>
        <p className="nakacult-section__sub">
          The cult is binary. You hold the threshold, or you don&apos;t. Every chamber is private. Every signal moves to members first.
        </p>

        <div className="nakacult-features">
          {[
            { n: '01', t: 'Early calls, in writing', b: 'The Daily Seal lands before the open. Public facing research lags by hours so the cult always moves first.' },
            { n: '02', t: 'Governance with weight', b: 'One vote per sigil. Chosen members vote twice. Decrees that pass move the treasury without committee delay.' },
            { n: '03', t: 'Private comms', b: 'The Whisper Network is libsodium end to end encrypted. Keys ship to your device only. The server cannot read.' },
            { n: '04', t: 'An identity layer', b: 'The Mantle and Annals turn the cult into a permanent on record stage. Achievements stick to your sigil, not your wallet.' },
            { n: '05', t: 'Sound, by Ddergo', b: 'The Library plays inside the Sanctum. Eight tracks scored for the chamber. The cult sounds different than the dashboard.' },
            { n: '06', t: 'No staking, no churn', b: 'Membership is your wallet’s balance, checked on chain daily. Drop below the threshold, drop out. Pick it back up, walk back in.' },
          ].map((f, i) => (
            <div
              key={f.n}
              className="nakacult-feature"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span className="nakacult-feature__num">{f.n}</span>
              <h4 className="nakacult-feature__title">{f.t}</h4>
              <p className="nakacult-feature__body">{f.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ENTRY */}
      <section id="enter" className="nakacult-section">
        <p className="nakacult-section__eyebrow">How to enter</p>
        <h2 className="nakacult-section__title">Three paths into the cult</h2>
        <p className="nakacult-section__sub">
          The cult cannot be bought, only held. Three paths recognize you. Each path is verified on chain and unlocks the same Vault.
        </p>

        <div className="nakacult-entries">
          <article className="nakacult-entry">
            <div className="nakacult-entry__head">
              <span className="nakacult-entry__num">1</span>
              <h3 className="nakacult-entry__title">Hold ≥ 1,227,000 $NAKA</h3>
            </div>
            <p className="nakacult-entry__body">
              Direct on chain holding. The resolver verifies your wallet daily and grants Cultist tier automatically. Drop below, drop out. Pick the threshold back up and walk back in.
            </p>
            <div className="nakacult-entry__foot">Open path · ETH mainnet</div>
          </article>

          <article className="nakacult-entry">
            <div className="nakacult-entry__head">
              <span className="nakacult-entry__num">2</span>
              <h3 className="nakacult-entry__title">Hold the Loyalty Gem NFT</h3>
            </div>
            <p className="nakacult-entry__body">
              A perpetual key. Minted at $27 the next time the doors open. Supply is intentionally small. Holders never need to maintain a NAKA threshold.
            </p>
            <div className="nakacult-entry__foot">Limited mints · Cult only access</div>
          </article>

          <article className="nakacult-entry nakacult-entry--chosen">
            <div className="nakacult-entry__head">
              <span className="nakacult-entry__num">3</span>
              <h3 className="nakacult-entry__title">Hold the Development NFT</h3>
            </div>
            <p className="nakacult-entry__body">
              A $48 mint marking you as <strong>Chosen</strong>. Gold trim across the Vault, double vote weight in the Conclave, the Elder Chamber inside the Sanctum.
            </p>
            <div className="nakacult-entry__foot">Chosen tier · 2× governance weight</div>
          </article>
        </div>
      </section>

      {/* FAQ */}
      <section className="nakacult-section">
        <p className="nakacult-section__eyebrow">Common questions</p>
        <h2 className="nakacult-section__title">Before you knock</h2>

        <div className="nakacult-faq">
          {[
            { q: 'What is the Naka Cult?', a: 'The Naka Cult is the inner ring of Naka Labs. It is a private surface of the platform, three chambers behind a sigil, built for members who watched before the noise. Membership is non transferable from the outside. It is verified by what your wallet holds.' },
            { q: 'Is membership a subscription?', a: 'No. There are no recurring fees. Membership is on chain. Hold ≥ 1,227,000 $NAKA, or hold the Loyalty Gem NFT, or hold the Development NFT. The resolver checks your wallet daily.' },
            { q: 'What if I drop below the NAKA threshold?', a: 'The next daily resolver run revokes access. The instant you pick the threshold back up, the next run restores it. Your Annals entries and Mantle persist. Only the chambers go dark.' },
            { q: 'Can my DMs be read by the server?', a: 'No. The Whisper Network uses libsodium end to end encryption. Conversation keys are sealed to participant public keys. Private keys never leave the device. Even Naka Labs cannot decrypt your messages.' },
            { q: 'What does the Chosen badge unlock?', a: 'Double vote weight in the Conclave, the Elder Chamber inside the Sanctum, gold trim across the Vault, and priority access to mint windows for future NFTs.' },
            { q: 'When do the doors open next?', a: 'The cult opens on its own cadence. Never on a public schedule. Hold the NAKA threshold today and you walk in the moment the resolver runs.' },
          ].map((f) => (
            <details key={f.q} className="nakacult-faq__item">
              <summary className="nakacult-faq__q">{f.q}</summary>
              <p className="nakacult-faq__a">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="nakacult-final">
        <span className="nakacult-final__halo" aria-hidden />
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
