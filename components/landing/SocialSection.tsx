'use client';

/**
 * SocialSection — landing-page surface introducing the social layer.
 * Added per master prompt §7.1 (landing must mention social + onboarding).
 *
 * Renders four pillars (follow / encrypted DMs / leaderboards /
 * reputation) with concise copy + CTAs that route to the live
 * discovery surface for users who already have an account.
 */

import Link from 'next/link';
import { Users, Lock, Trophy, ShieldCheck, ArrowRight } from 'lucide-react';

const PILLARS = [
  {
    icon: Users,
    title: 'Follow real performers',
    body: 'Follow whales, top traders, and platform power-users. One-way by default; mutual unlocks DMs.',
  },
  {
    icon: Lock,
    title: 'End-to-end encrypted DMs',
    body: 'libsodium box+secretbox. Server stores ciphertext only. Mutual follows can talk; nobody else can listen.',
  },
  {
    icon: Trophy,
    title: 'Eight live leaderboards',
    body: 'Top success rate, top followers, top traders (30d), copy-traders, whale-watchers, most-active, max-tier, new joiners.',
  },
  {
    icon: ShieldCheck,
    title: 'Performance-based reputation',
    body: 'Composite score: copy-trade win rate · whale-pick accuracy · portfolio percentile · community signal · activity. Recomputed nightly.',
  },
];

export function SocialSection() {
  return (
    <section id="social" className="relative py-24 px-5">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span
            className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-4"
            style={{
              background: 'rgba(0,102,255,.10)',
              color: 'var(--nl-text-secondary,#8FA3FF)',
              border: '1px solid rgba(0,102,255,.25)',
            }}
          >
            Social Layer
          </span>
          <h2 className="text-[40px] max-md:text-[28px] font-black text-white tracking-tight leading-tight">
            Reputation built on real trades.
          </h2>
          <p className="mt-3 text-[16px] max-w-2xl mx-auto" style={{ color: 'var(--nl-text-muted,#B4C0E0)' }}>
            Not opinions. Not vibes. Every leaderboard rank is calculated from on-chain activity you can verify.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl p-5 border transition-all hover:border-[var(--nl-blue,#0066FF)]/40"
              style={{
                background: 'rgba(255,255,255,.025)',
                borderColor: 'rgba(255,255,255,.08)',
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(0,102,255,.10)' }}
                >
                  <Icon className="w-4 h-4 text-[var(--nl-blue,#0066FF)]" />
                </div>
                <h3 className="text-base font-bold text-white">{title}</h3>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--nl-text-muted,#B4C0E0)' }}>
                {body}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#0066FF,#3d57ff)', boxShadow: '0 0 20px rgba(0,102,255,.35)' }}
          >
            Explore Discover <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/docs/social"
            className="text-sm font-medium underline-offset-4 hover:underline"
            style={{ color: 'var(--nl-text-secondary,#8FA3FF)' }}
          >
            Read the social docs →
          </Link>
        </div>
      </div>
    </section>
  );
}
