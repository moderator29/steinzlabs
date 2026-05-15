'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen, KeyRound, Vote, Eye, Crown, Shield, Settings2, HelpCircle,
  Map as MapIcon, FileText, Search, ChevronRight, ChevronLeft, X, Menu,
} from 'lucide-react';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import BackButton from '@/components/ui/BackButton';
import GlobalControls from '@/components/GlobalControls';

/**
 * /docs/vault — public, comprehensive Vault & NakaCult documentation.
 *
 * Single-file by design: every Vault doc lives on this page with anchor
 * links per section. The /docs root has its own 13-section build using
 * one component per section; this surface is a separate, self-contained
 * piece of cult-facing lore + spec so it can ship and evolve on its own
 * cadence without touching that route.
 *
 * Spec §8 — ten required sections (Introduction, How to Enter, The
 * Conclave, The Oracle, The Sanctum, The Chosen Seal, Cult Mechanics,
 * Security & Privacy, FAQ, Roadmap), sticky sidebar nav, search,
 * anchor links, mobile responsive, dark default, aurora brand.
 */

const SECTIONS = [
  { id: 'introduction',  label: 'Introduction',        icon: BookOpen },
  { id: 'how-to-enter',  label: 'How to Enter',        icon: KeyRound },
  { id: 'conclave',      label: 'The Conclave',        icon: Vote },
  { id: 'oracle',        label: 'The Oracle',          icon: Eye },
  { id: 'sanctum',       label: 'The Sanctum',         icon: Crown },
  { id: 'chosen-seal',   label: 'The Chosen Seal',     icon: Crown },
  { id: 'mechanics',     label: 'Cult Mechanics',      icon: Settings2 },
  { id: 'security',      label: 'Security & Privacy',  icon: Shield },
  { id: 'faq',           label: 'FAQ',                 icon: HelpCircle },
  { id: 'roadmap',       label: 'Roadmap',             icon: MapIcon },
] as const;

const NAKA_CONTRACT = '0x6967b9a8c0b14849CFE8f9E5732B401433fD2898';

function H({ id, children, eyebrow }: { id: string; children: React.ReactNode; eyebrow?: string }) {
  return (
    <header className="mb-5 scroll-mt-24" id={id}>
      {eyebrow && (
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#FF1744]/80 mb-2">{eyebrow}</div>
      )}
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{children}</h2>
      <a href={`#${id}`} className="text-[11px] text-white/30 hover:text-white/60 transition-colors mt-1 inline-block">
        # {id}
      </a>
    </header>
  );
}

function H3({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-lg sm:text-xl font-semibold mt-8 mb-3 scroll-mt-24 text-white/95">{children}</h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm sm:text-[15px] leading-relaxed text-white/75 mb-4">{children}</p>;
}

function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc list-outside pl-5 space-y-2 text-sm sm:text-[15px] text-white/75 mb-4">{children}</ul>;
}

function Callout({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'gold'; children: React.ReactNode }) {
  const palette = tone === 'warn'
    ? 'border-[#FF1744]/30 bg-[#FF1744]/[0.06]'
    : tone === 'gold'
    ? 'border-[#FFD86B]/30 bg-[#FFD86B]/[0.05]'
    : 'border-[#0066FF]/30 bg-[#0066FF]/[0.06]';
  return (
    <div className={`rounded-xl border ${palette} px-4 py-3 my-4 text-sm leading-relaxed text-white/85`}>
      {children}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/10 font-mono text-[12px] text-white/90">
      {children}
    </code>
  );
}

function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="rounded-xl border border-white/10 bg-[#05070F] p-4 overflow-x-auto text-[12px] leading-relaxed font-mono text-white/85 my-4">
      {children}
    </pre>
  );
}

export default function VaultDocsPage() {
  const [activeId, setActiveId] = useState<string>('introduction');
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Highlight the current sidebar entry based on the section in view.
  useEffect(() => {
    const els = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (!els.length || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: [0, 0.5, 1] },
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const filteredSections = useMemo(() => {
    if (!query.trim()) return SECTIONS;
    const q = query.toLowerCase();
    return SECTIONS.filter(s => s.label.toLowerCase().includes(q) || s.id.includes(q));
  }, [query]);

  return (
    <AuroraBackground fullHeight>
      <div className="min-h-screen text-white">
        {/* Top bar */}
        <div className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0A0E27]/85 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(v => !v)}
              className="md:hidden p-2 -ml-2 rounded-lg hover:bg-white/[0.06]"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <BackButton href="/" label="Home" />
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-4 h-4 text-[#FFD86B]" />
              <span className="text-sm font-bold tracking-tight truncate">The Naka Vault — Documentation</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <GlobalControls />
            </div>
          </div>
        </div>

        <div ref={containerRef} className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-8 pt-6 pb-24">
          {/* Sidebar */}
          <aside
            className={`md:sticky md:top-20 md:self-start md:max-h-[calc(100vh-6rem)] md:overflow-y-auto ${mobileOpen ? 'block' : 'hidden md:block'}`}
          >
            <div className="relative mb-3">
              <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 left-3 text-white/40" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search sections"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-[12px] placeholder:text-white/30 focus:outline-none focus:border-[#0066FF]/50"
                aria-label="Search documentation sections"
              />
            </div>
            <nav aria-label="Vault docs sections" className="flex flex-col gap-0.5">
              {filteredSections.map(s => {
                const Icon = s.icon;
                const active = s.id === activeId;
                return (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    onClick={() => setMobileOpen(false)}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                      active
                        ? 'bg-[#0066FF]/[0.12] text-white font-semibold'
                        : 'text-white/65 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {active && <span aria-hidden className="absolute left-0 w-[3px] h-5 rounded-r-full bg-[#0066FF]" />}
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#0066FF]' : 'text-white/40 group-hover:text-white/70'}`} />
                    <span className="truncate">{s.label}</span>
                  </a>
                );
              })}
              {filteredSections.length === 0 && (
                <div className="text-[12px] text-white/40 px-3 py-2">No matches.</div>
              )}
            </nav>
            <div className="mt-6 pt-4 border-t border-white/10 text-[10px] text-white/35 leading-relaxed">
              The Vault doc is a living spec. Every section reflects what is live in the platform on the day you read it.
            </div>
          </aside>

          {/* Body */}
          <main className="min-w-0">
            <section className="mb-16">
              <H id="introduction" eyebrow="01 — Lore + Premise">Introduction</H>
              <P>
                The Naka Vault is the inner chamber of the Steinz Labs platform. It is not a feature — it is a private
                house owned by the holders of <Code>$NAKA</Code> and the bearers of the NakaLabs NFTs. Inside live three
                rooms: the Conclave, the Oracle, and the Sanctum. Each room is earned, none are given.
              </P>
              <P>
                The Vault exists because Naka Go&apos;s breed was saved by a small group of people who refuse to let it die.
                Every member of the Cult holds the same charge — preserve the lineage, run the order, outlive us all.
              </P>
              <Callout tone="gold">
                Membership is non-custodial. We never hold your private keys. Your wallet stays your wallet.
              </Callout>
            </section>

            <section className="mb-16">
              <H id="how-to-enter" eyebrow="02 — Onboarding">How to Enter</H>
              <P>There are exactly two doors into the Vault. Both lead to the same hallway.</P>
              <H3>Door one — hold the threshold balance</H3>
              <UL>
                <li>Connect any EVM wallet via WalletConnect / Reown AppKit.</li>
                <li>Hold at least <strong>1,227,000 <Code>$NAKA</Code></strong> in your detection wallet.</li>
                <li>Sign a one-time SIWE message to prove ownership. The server-side verifier reads your balance
                  directly on-chain via Alchemy. We never trust client-reported balances.</li>
              </UL>
              <H3>Door two — bear a Naka NFT</H3>
              <UL>
                <li><strong>$27 Loyalty Gem</strong> — unlocks Pro tier and Vault entry. Read-only access.</li>
                <li><strong>$48 Development NFT</strong> — unlocks Max tier and the Chosen Seal. Write access in the
                  Oracle, double weight in the Conclave, curation rights in the Sanctum.</li>
              </UL>
              <H3>What we provision for you</H3>
              <UL>
                <li>An auto-generated Naka-username (rotatable from Profile → Edit).</li>
                <li>A profile row scoped to <Code>profiles.tier = &apos;naka_cult&apos;</Code>.</li>
                <li>A separation between your <em>detection wallet</em> (the one we read balance from) and your
                  <em>trading wallet</em> (the one that signs swap transactions). One can be the other; they are not
                  required to be.</li>
              </UL>
              <Callout tone="warn">
                You have a 7-day grace window. If your balance drops below the threshold for any reason, your Cult
                privileges hibernate until you restore it; nothing is forfeited.
              </Callout>
            </section>

            <section className="mb-16">
              <H id="conclave" eyebrow="03 — Governance">The Conclave</H>
              <P>The Conclave is where the Cult speaks. Three kinds of proposals can be brought before the chamber.</P>
              <H3>Proposal types</H3>
              <UL>
                <li><strong>Decree</strong> — binding direction (treasury moves, policy changes). Passes at a 60% yes
                  share of cast weight with a minimum 5% turnout of total Cult weight.</li>
                <li><strong>Edict</strong> — non-binding signal. Pass conditions are the same; outcome is recorded in
                  the Codex but does not auto-execute.</li>
                <li><strong>Inquiry</strong> — a question put to the Cult. Surface-level only; recorded in the Codex.</li>
              </UL>
              <H3>Weighting</H3>
              <P>
                Your weight equals your NAKA balance at proposal-snapshot time, divided by 1,000,000 and capped at 25
                units (so a single whale cannot dominate). Chosen Seal bearers earn a <strong>2&times;</strong> multiplier
                on top.
              </P>
              <H3>Stake to propose</H3>
              <P>
                Submitting a proposal locks <strong>100 <Code>$NAKA</Code></strong> for the duration of the vote. The
                stake returns to your wallet at close — regardless of outcome — unless the Codex flags the proposal as
                spam by majority vote, in which case the stake is forfeit to the Treasury.
              </P>
              <H3>Treasury Dashboard</H3>
              <P>
                The Treasury reads its balances live from Alchemy. Every passed Decree that requires a treasury move
                produces a queued multisig action visible to all Cult members. The Codex pins the post-execution tx
                hash.
              </P>
            </section>

            <section className="mb-16">
              <H id="oracle" eyebrow="04 — Intelligence">The Oracle</H>
              <P>The Oracle is the daily voice of the Cult, made of four parts.</P>
              <H3>Daily Seal — 07:00 UTC</H3>
              <P>
                A short brief generated by Claude (Anthropic) at dawn. It surveys overnight on-chain activity, surfaces
                three watch points for the day, and is pinned at the top of the Oracle until 07:00 the following day.
                Chosen Seal bearers can write the next day&apos;s draft directly from the Oracle hub.
              </P>
              <H3>VTX Sage</H3>
              <P>
                A long-context VTX mode that ingests up to the last 200 events from the Context Feed for the chains you
                follow, plus your wallet history, before answering. Tier limits: 50 messages/day for Cult members, 200
                for Chosen.
              </P>
              <H3>Whisper Network</H3>
              <P>
                Anonymous, server-side-only posting. Whisper authors are stripped from the client payload; only the
                server sees the binding to a profile id, and the binding is one-way-hashed before storage. Upvotes
                surface a Whisper into the Echo Chamber.
              </P>
              <H3>Echo Chamber</H3>
              <P>
                Daily top-3 community calls, ranked by weighted upvotes. The Cult&apos;s consensus on what mattered in
                the last 24h.
              </P>
            </section>

            <section className="mb-16">
              <H id="sanctum" eyebrow="05 — Identity">The Sanctum</H>
              <P>The Sanctum is the room where the Cult&apos;s identity lives.</P>
              <H3>The Mantle</H3>
              <P>Customize your sigil, banner, and Naka-username. Chosen Seal bearers unlock the gold-trim sigil set.</P>
              <H3>The Annals</H3>
              <P>Lifetime achievements + leaderboards (Conclave influence, Oracle correct calls, Treasury contributions).</P>
              <H3>The Library</H3>
              <P>Music, lore, art uploads. The library is moderated by the Chosen as a rotating duty.</P>
              <H3>The Forge</H3>
              <P>NFT showcase. Connect any wallet and surface verified ERC-721 / ERC-1155 holdings beside your profile.</P>
            </section>

            <section className="mb-16">
              <H id="chosen-seal" eyebrow="06 — Lineage">The Chosen Seal</H>
              <P>
                The Chosen Seal is the gold mark of the lineage. It is earned by holding the <strong>$48 Development
                NFT</strong> at any point in the audited window. Once earned, it persists across NFT transfers — the Cult
                tracks lineage, not the asset.
              </P>
              <H3>What it unlocks</H3>
              <UL>
                <li>The Elder Chamber — Chosen-only governance side-channel.</li>
                <li>Quarterly Audience — a live call with the founder.</li>
                <li>Early Access Lab — pre-release features two weeks before public.</li>
                <li>Custom sigil set + gold-trim avatar treatment.</li>
                <li>Chronicles — your name written into the Annals permanently.</li>
                <li>Tokenized rewards (Phase 3) — share of fee-flow back to lineage holders.</li>
              </UL>
            </section>

            <section className="mb-16">
              <H id="mechanics" eyebrow="07 — How the order runs">Cult Mechanics</H>
              <H3>Vote weighting</H3>
              <Pre>{`weight = min(25, floor(naka_balance / 1_000_000))
       * (is_chosen ? 2 : 1)
       * (active_membership ? 1 : 0)`}</Pre>
              <H3>Proposal passing</H3>
              <UL>
                <li>Quorum: 5% of total active Cult weight must cast a vote.</li>
                <li>Pass: 60% yes share among cast weight.</li>
                <li>Window: 72h from open. Extends 12h if quorum is missed at hour 60.</li>
              </UL>
              <H3>Decree execution</H3>
              <P>
                Treasury moves are queued as multisig actions on the on-chain safe. The Codex pins the tx hash post-
                execution. Edicts and Inquiries surface no on-chain side effect.
              </P>
              <H3>Balance verification</H3>
              <P>
                Server-side, on every Cult-gated action. We re-fetch the detection wallet&apos;s balance from Alchemy
                with a 5-minute cache. The 7-day grace window only protects against transient drops — sustained sub-
                threshold balance hibernates the membership.
              </P>
              <H3>The 7-day grace</H3>
              <Callout>
                If your detection wallet drops below 1,227,000 NAKA, you have 7 days to restore it before privileges
                hibernate. Nothing is forfeited. Restore the balance to reactivate.
              </Callout>
            </section>

            <section className="mb-16">
              <H id="security" eyebrow="08 — Trust">Security &amp; Privacy</H>
              <H3>Detection wallet vs trading wallet</H3>
              <P>
                Your <em>detection wallet</em> is the address we read balance from to verify Cult eligibility. Your
                <em>trading wallet</em> is whatever wallet you sign swap transactions with — we never assume they are
                the same. You can rotate either at any time without losing your seat.
              </P>
              <H3>SIWE</H3>
              <P>
                Wallet auth uses a Sign-In With Ethereum nonce flow. The nonce is single-use and expires after 5
                minutes. The signature is verified server-side and discarded after producing a Supabase session.
              </P>
              <H3>Server-side balance checks</H3>
              <P>
                Every Cult-gated read and write re-checks the on-chain balance via Alchemy. Client-reported balances
                are never trusted. RLS prevents direct reads of the <Code>cult_*</Code> tables without a verified
                session.
              </P>
              <H3>No private keys</H3>
              <P>
                We never hold your private keys, seed phrases, or wallet credentials. All trading signs through the
                connected wallet&apos;s own signer.
              </P>
              <H3>Whisper anonymity</H3>
              <P>
                Whisper authors are stripped server-side before the payload reaches any client. The binding (profile_id
                ↔ whisper_id) is one-way-hashed with a server-side secret so a database snapshot cannot reconstruct
                authorship.
              </P>
            </section>

            <section className="mb-16">
              <H id="faq" eyebrow="09 — Questions">FAQ</H>
              <H3 id="faq-sell">Can I sell my NAKA after entering?</H3>
              <P>
                Yes. If your detection wallet&apos;s balance drops below threshold you enter the 7-day grace window;
                refill or transfer back to restore privileges. The Cult never custodies your tokens.
              </P>
              <H3 id="faq-no-nft">Can I enter without an NFT?</H3>
              <P>Yes — holding 1,227,000 NAKA in any EVM wallet you control is sufficient.</P>
              <H3 id="faq-27-vs-48">$27 Loyalty Gem vs $48 Development NFT — what&apos;s the actual difference?</H3>
              <P>
                The Gem grants Pro tier + Vault entry only. The Development NFT grants Max tier, the Chosen Seal, double
                Conclave weight, Oracle write-access, Sanctum curation rights, and a share of the future tokenized
                rewards flow.
              </P>
              <H3 id="faq-stake-refund">Can I get my Conclave proposal stake back?</H3>
              <P>
                Yes — at vote close, regardless of outcome. The only case where the stake is forfeit is when a majority
                Codex flag marks the proposal as spam.
              </P>
              <H3 id="faq-leave">Can I leave NakaCult?</H3>
              <P>
                Yes. Either transfer your NAKA below threshold (privileges hibernate after the grace window) or contact
                support and we&apos;ll mark the profile <Code>tier = &apos;free&apos;</Code> on request. We do not retain Cult
                writes (votes, Whispers) post-departure — they remain in the Codex for historical integrity.
              </P>
              <H3 id="faq-vote-public">Is my voting power public?</H3>
              <P>
                Aggregate cast weight is public per proposal. Individual votes are not unless you opt-in via Mantle
                preferences (default: private).
              </P>
            </section>

            <section className="mb-20">
              <H id="roadmap" eyebrow="10 — Forward">Roadmap</H>
              <H3>Phase 1 — Live</H3>
              <UL>
                <li>NakaCult launches. Three chambers fully wired. Daily Seal cron at 07:00 UTC.</li>
                <li>Conclave with weighted voting, treasury read, Codex pinning.</li>
                <li>Whisper Network + Echo Chamber.</li>
              </UL>
              <H3>Phase 2 — NFTs mint</H3>
              <UL>
                <li>$27 Loyalty Gem + $48 Development NFT public mint.</li>
                <li>Chosen Seal auto-grant on mint detection.</li>
              </UL>
              <H3>Phase 3 — Tokenized rewards</H3>
              <UL>
                <li>Platform fee share routed to a Cult-owned vault contract.</li>
                <li>Lineage-weighted claim flow for Chosen Seal bearers.</li>
              </UL>
              <H3>Phase 4 — Cross-platform expansion</H3>
              <UL>
                <li>Cult-only API for builders outside the Steinz Labs platform.</li>
                <li>Cross-chain detection (NAKA wrapping on Solana, etc.).</li>
              </UL>
              <Callout tone="gold">
                Canonical NAKA contract — Ethereum:
                <span className="block mt-1 font-mono text-[12px] text-white/85 break-all">{NAKA_CONTRACT}</span>
              </Callout>
            </section>

            <div className="flex items-center justify-between border-t border-white/10 pt-6 text-[12px] text-white/50">
              <Link href="/" className="inline-flex items-center gap-1 hover:text-white">
                <ChevronLeft className="w-3 h-3" /> Back to the landing
              </Link>
              <Link href="/?view=cult" className="inline-flex items-center gap-1 hover:text-white">
                Open the NakaCult landing <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </main>
        </div>
      </div>
    </AuroraBackground>
  );
}
