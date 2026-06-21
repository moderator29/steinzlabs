import Link from 'next/link';
import { getCultAccess } from '@/lib/cult/access';
import { ConclaveSigil } from '@/components/vault/sigils/ConclaveSigil';
import { OracleSigil } from '@/components/vault/sigils/OracleSigil';
import { SanctumSigil } from '@/components/vault/sigils/SanctumSigil';
import { LivingSigil } from '@/components/naka-cult/LivingSigil';
import { CultStatsStrip } from '@/components/naka-cult/CultStatsStrip';
import { PauseAnimationsOnHidden } from '@/components/perf/PauseAnimationsOnHidden';
import './landing.css';

export const metadata = {
  title: 'The Naka Cult · The Inner Ring',
  description:
    'Three chambers behind one living sigil. Private intel, member governance, and a permanent on-chain identity — for the wallets that held before the noise.',
};

// Dynamic — the per-user CTA (isMember) depends on session cookies via
// getCultAccess(). CultStatsStrip caches its own query for 60s.
export const dynamic = 'force-dynamic';

/**
 * /naka-cult — the cinematic, public landing for the cult. Rebrand: "The
 * Living Sigil". Membership is the decoupled cult entitlement (NIPPO NFT or
 * a NAKA balance) — NOT a platform tier. Members route straight to /vault.
 */
export default async function NakaCultLanding() {
  const access = await getCultAccess();
  const isMember = access.allowed;

  return (
    <div className="nakacult-shell">
      <PauseAnimationsOnHidden />
      <div className="nakacult-orb-layer" aria-hidden>
        <span className="nakacult-orb nakacult-orb--blue" />
        <span className="nakacult-orb nakacult-orb--crimson" />
        <span className="nakacult-orb nakacult-orb--gold" />
      </div>

      {/* HERO */}
      <section className="nakacult-hero">
        <div className="nakacult-hero__sigil">
          <LivingSigil size={360} />
        </div>
        {isMember && <span className="nakacult-status">◈ You are of the Cult</span>}
        <p className="nakacult-hero__eyebrow">◈ The Naka Cult</p>
        <h1 className="nakacult-hero__title">The inner ring.</h1>
        <p className="nakacult-hero__tagline">
          Three chambers behind one living sigil. Private intel, member governance, and a
          permanent on-chain identity — held by the wallets that watched before the noise.
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
          Each chamber is its own ritual. Members move between them as one. The cult speaks
          first; the world hears later.
        </p>

        <div className="nakacult-pillars">
          <article className="nakacult-pillar" style={{ animationDelay: '0ms' }}>
            <div className="nakacult-pillar__sigil"><ConclaveSigil size={72} /></div>
            <span className="nakacult-pillar__tagline">The will</span>
            <h3 className="nakacult-pillar__name">The Conclave</h3>
            <p className="nakacult-pillar__desc">
              Governance built for action. Members author <strong>Decrees</strong>, raise{' '}
              <strong>Whispers</strong>, and vote with weighted sigils. The Conclave moves the
              treasury and sets the cult&apos;s direction in the open.
            </p>
            <ul className="nakacult-pillar__list">
              <li>Decrees — binding proposals</li>
              <li>Whispers — temperature checks</li>
              <li>Treasury panel — real-time, on-chain</li>
              <li>Chosen weight ×2 governance</li>
            </ul>
          </article>

          <article className="nakacult-pillar" style={{ animationDelay: '120ms' }}>
            <div className="nakacult-pillar__sigil"><OracleSigil size={72} /></div>
            <span className="nakacult-pillar__tagline">The sight</span>
            <h3 className="nakacult-pillar__name">The Oracle</h3>
            <p className="nakacult-pillar__desc">
              Signal before the crowd. Read the <strong>Daily Seal</strong> at dawn, query the{' '}
              <strong>Sage</strong> for cult-only analysis, and trade alpha inside the{' '}
              <strong>Whisper Network</strong>.
            </p>
            <ul className="nakacult-pillar__list">
              <li>Daily Seal — dawn briefing</li>
              <li>The Sage — cult-context AI</li>
              <li>Whisper Network — E2E encrypted</li>
              <li>Echo Chamber — early-calls log</li>
            </ul>
          </article>

          <article className="nakacult-pillar" style={{ animationDelay: '240ms' }}>
            <div className="nakacult-pillar__sigil"><SanctumSigil size={72} /></div>
            <span className="nakacult-pillar__tagline">The soul</span>
            <h3 className="nakacult-pillar__name">The Sanctum</h3>
            <p className="nakacult-pillar__desc">
              Identity made permanent. Choose a <strong>Mantle</strong>, write into the{' '}
              <strong>Annals</strong>, and let the <strong>Library</strong> play — Ddergo&apos;s
              soundtrack, scored for the chamber and streaming the moment you walk in.
            </p>
            <ul className="nakacult-pillar__list">
              <li>The Mantle — your chosen title</li>
              <li>The Annals — your record</li>
              <li>The Library — ambient, auto-play</li>
              <li>The Forge — sigil collection</li>
            </ul>
          </article>
        </div>
      </section>

      {/* WHAT MEMBERS GET */}
      <section className="nakacult-section">
        <p className="nakacult-section__eyebrow">Cult only</p>
        <h2 className="nakacult-section__title">Held by sigil, not subscription</h2>
        <p className="nakacult-section__sub">
          The cult is binary — you hold the key or you don&apos;t. Every chamber is private.
          Every signal reaches members first.
        </p>

        <div className="nakacult-features">
          {[
            { n: '01', t: 'Early calls, in writing', b: 'The Daily Seal lands before the open. Public-facing research lags by hours, so the cult always moves first.' },
            { n: '02', t: 'Governance with weight', b: 'One vote per sigil. Chosen members vote twice. Decrees that pass move the treasury without committee delay.' },
            { n: '03', t: 'Private comms', b: 'The Whisper Network is libsodium end-to-end encrypted. Keys ship to your device only — the server cannot read a word.' },
            { n: '04', t: 'A permanent identity', b: 'The Mantle and Annals turn the cult into an on-record stage. Achievements stick to your sigil, not your wallet balance.' },
            { n: '05', t: 'Sound, by Ddergo', b: 'The Library auto-plays inside the Vault — a soundtrack scored for the chamber. The cult sounds nothing like the dashboard.' },
            { n: '06', t: 'No staking, no churn', b: 'Membership is your wallet — checked on-chain. Hold the key and you are in; let it go and the chambers go dark until you return.' },
          ].map((f, i) => (
            <div key={f.n} className="nakacult-feature" style={{ animationDelay: `${i * 70}ms` }}>
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
        <h2 className="nakacult-section__title">Two keys open the cult</h2>
        <p className="nakacult-section__sub">
          The cult cannot be bought by subscription — only held. Either key is verified on-chain
          and unlocks the same Vault. Connect your wallet and the sigil knows you.
        </p>

        <div className="nakacult-entries">
          <article className="nakacult-entry nakacult-entry--chosen">
            <div className="nakacult-entry__head">
              <span className="nakacult-entry__num">1</span>
              <h3 className="nakacult-entry__title">Hold the NIPPO NFT</h3>
            </div>
            <p className="nakacult-entry__body">
              The perpetual key. While the NIPPO sits in your wallet you are of the cult — no
              threshold to maintain, no monthly anything. Supply is intentionally small.
            </p>
            <div className="nakacult-entry__foot">Perpetual key · cult access while held</div>
          </article>

          <article className="nakacult-entry">
            <div className="nakacult-entry__head">
              <span className="nakacult-entry__num">2</span>
              <h3 className="nakacult-entry__title">Hold ≥ 1,227,000 $NAKA</h3>
            </div>
            <p className="nakacult-entry__body">
              The open path. The resolver checks your wallet daily and grants access
              automatically. Drop below, drop out; pick the threshold back up and walk back in.
            </p>
            <div className="nakacult-entry__foot">Open path · ETH mainnet · checked daily</div>
          </article>
        </div>

        <p className="nakacult-entry__note">
          Looking for the <strong>Founder Pass</strong>? That key is different — it unlocks{' '}
          <strong>Max on the main Naka Labs platform</strong>, not the cult. Two doors, two keys.
        </p>
      </section>

      {/* FAQ */}
      <section className="nakacult-section">
        <p className="nakacult-section__eyebrow">Common questions</p>
        <h2 className="nakacult-section__title">Before you knock</h2>

        <div className="nakacult-faq">
          {[
            { q: 'What is the Naka Cult?', a: 'The inner ring of Naka Labs — a private surface of three chambers behind one sigil, built for members who watched before the noise. Membership is verified by what your wallet holds, not by a subscription.' },
            { q: 'Is membership a platform tier?', a: 'No. Cult membership is a separate, on-chain entitlement — completely independent of the Free/Mini/Pro/Max platform plans. You can be a cult member on any plan, and a paid member without being in the cult.' },
            { q: 'How do I get in?', a: 'Hold the NIPPO NFT, or hold ≥ 1,227,000 $NAKA. Connect your wallet to Naka Labs and the resolver detects either one and opens the Vault automatically.' },
            { q: 'What if I drop below the NAKA threshold?', a: 'The next daily resolver run closes the chambers. The instant you hold the threshold again, the next run restores you. Your Annals entries and Mantle persist — only access goes dark. NIPPO holders never face a threshold.' },
            { q: 'Can my DMs be read by the server?', a: 'No. The Whisper Network uses libsodium end-to-end encryption. Conversation keys are sealed to participant public keys; private keys never leave the device. Even Naka Labs cannot decrypt your messages.' },
            { q: 'Is the Founder Pass a way into the cult?', a: 'No — the Founder Pass grants Max-tier access on the main platform, not cult membership. The cult is the NIPPO and the NAKA threshold. They are deliberately separate keys.' },
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
          {isMember ? 'The Vault remembers you.' : 'The sigil is waiting.'}
        </h2>
        <p className="nakacult-final__sub">
          {isMember
            ? 'Walk in. The chambers are warm and today’s Seal is already written.'
            : 'Hold the NIPPO or carry the threshold, connect your wallet, and the cult will know you on sight.'}
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
