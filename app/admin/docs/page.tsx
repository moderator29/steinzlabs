'use client';

import { useState } from 'react';
import {
  FileText, Layers, Shield, Brain, ShieldCheck, AlertTriangle, Zap, Users,
  Lock, KeyRound, Database, Cpu, Network, Globe, BookOpen, TrendingUp,
  Crosshair, Repeat, BarChart3, LifeBuoy, Sparkles, Activity, CheckCircle,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Layout primitives                                                  */
/* ------------------------------------------------------------------ */

function S({ id, kicker, title, n, children }: {
  id: string; kicker?: string; title: string; n: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-14 scroll-mt-24 pb-12 border-b border-white/[0.05] last:border-0">
      <div className="mb-6">
        {kicker && <div className="text-[11px] uppercase tracking-[0.18em] text-[#4D6BFF] font-semibold mb-2">{kicker}</div>}
        <div className="flex items-baseline gap-4">
          <span className="text-4xl sm:text-5xl font-black text-white/[0.05] font-mono select-none leading-none">{n}</span>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{title}</h2>
        </div>
      </div>
      <div className="space-y-4 text-[14px] text-gray-400 leading-[1.75]">{children}</div>
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold text-white mt-8 mb-3 tracking-tight">{children}</h3>;
}

function H4({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-bold text-white/80 mt-5 mb-2">{children}</h4>;
}

function Callout({
  variant = 'info', icon: Icon, title, children,
}: {
  variant?: 'info' | 'warn' | 'ok' | 'danger';
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  const colors = {
    info:   { bg: 'rgba(10,30,255,0.08)',  border: 'rgba(10,30,255,0.30)',  fg: '#4D6BFF' },
    warn:   { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.30)', fg: '#F59E0B' },
    ok:     { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.30)', fg: '#10B981' },
    danger: { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.30)',  fg: '#EF4444' },
  }[variant];
  return (
    <div className="rounded-xl p-4 my-4" style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: colors.fg }} />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <div className="text-[13px] text-gray-300 leading-[1.7]">{children}</div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="text-[12px] bg-white/[0.06] px-1.5 py-0.5 rounded text-[#c4d1ff] font-mono">{children}</code>;
}

function KV({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-4">
      {items.map(([k, v]) => (
        <div key={k} className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">{k}</div>
          <div className="text-[13px] text-gray-200 mt-0.5">{v}</div>
        </div>
      ))}
    </div>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[13px] text-gray-300">
      <CheckCircle className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function Troubleshoot({
  symptom, checks, action,
}: { symptom: string; checks: string[]; action: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 my-3">
      <div className="text-sm font-bold text-white mb-2">&ldquo;{symptom}&rdquo;</div>
      <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Check, in order:</div>
      <ol className="text-[13px] text-gray-300 space-y-1 list-decimal pl-5 mb-3">
        {checks.map((c, i) => <li key={i}>{c}</li>)}
      </ol>
      <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Action:</div>
      <div className="text-[13px] text-emerald-300">{action}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TOC                                                                */
/* ------------------------------------------------------------------ */

const TOC = [
  { n: '01', label: 'Purpose of this doc',         id: 'purpose' },
  { n: '02', label: 'Platform architecture',       id: 'architecture' },
  { n: '03', label: 'Data flow end-to-end',        id: 'dataflow' },
  { n: '04', label: 'Authentication',              id: 'auth' },
  { n: '05', label: 'The non-custodial wallet',    id: 'wallet' },
  { n: '06', label: 'Feature deep-dives',          id: 'features' },
  { n: '07', label: 'Security infrastructure',     id: 'security' },
  { n: '08', label: 'Data sources & providers',    id: 'providers' },
  { n: '09', label: 'What makes us better',        id: 'moat' },
  { n: '10', label: 'CEO troubleshooting guide',   id: 'troubleshoot' },
  { n: '11', label: 'User access & tier controls', id: 'access' },
  { n: '12', label: 'Admin actions',               id: 'admin-actions' },
  { n: '13', label: 'Speaking on X Spaces',        id: 'spaces' },
  { n: '14', label: 'NFT (pre-raise fund) plan',   id: 'nft' },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminDocsPage() {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q ? TOC.filter((t) => t.label.toLowerCase().includes(q)) : TOC;

  return (
    <div className="min-h-screen bg-[#060A14] text-white">
      {/* Hero */}
      <div className="border-b border-white/[0.06] bg-gradient-to-br from-[#0A1EFF]/5 via-transparent to-[#10B981]/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
          <div className="inline-flex items-center gap-2 bg-[#0A1EFF]/10 border border-[#0A1EFF]/25 rounded-full px-3 py-1 text-xs text-[#4D6BFF] font-semibold mb-4">
            <FileText className="w-3 h-3" /> Admin-only · CEO briefing
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight mb-3">
            Naka Labs — Internal Platform Docs
          </h1>
          <p className="text-gray-400 max-w-3xl text-sm sm:text-base leading-relaxed">
            Everything you need to answer a hard question on an X Space, handle a user escalation, or explain the platform to a partner. Written in plain English, grouped by topic, searchable. Read what you need — no obligation to read top to bottom.
          </p>
          <div className="mt-6 max-w-md">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this doc…"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:border-[#0A1EFF]/40"
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 lg:flex lg:gap-12">
        {/* TOC */}
        <aside className="hidden lg:block w-60 flex-shrink-0">
          <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Contents</div>
            <nav className="space-y-0.5">
              {filtered.map((t) => (
                <a key={t.id} href={`#${t.id}`}
                   className="flex items-center gap-3 py-1.5 px-2 rounded-lg text-[12.5px] text-gray-500 hover:text-white hover:bg-white/[0.04] transition-all">
                  <span className="font-mono text-gray-700 text-[11px] w-5">{t.n}</span>
                  {t.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <main className="flex-1 min-w-0 max-w-3xl">

          {/* 01 — Purpose */}
          <S id="purpose" n="01" title="Purpose of this document" kicker="Start here">
            <p>
              You (the CEO) are not expected to be a deep systems engineer. You are expected to be able to speak intelligently about how the platform works, answer user questions in live settings, and triage incidents when they happen. This document exists to make that possible without you having to read code.
            </p>
            <p>Three use cases it&apos;s written for:</p>
            <ol className="list-decimal pl-5 space-y-1 text-gray-300">
              <li><strong className="text-white">Live Spaces and interviews.</strong> You will be asked technical-sounding questions. Section 13 gives you a talk-track for the most common ones.</li>
              <li><strong className="text-white">User escalations.</strong> &ldquo;Why can&apos;t I log in&rdquo;, &ldquo;My wallet disappeared&rdquo;, &ldquo;The platform is showing the wrong price&rdquo;. Section 10 walks through each symptom and the exact checks to run.</li>
              <li><strong className="text-white">Partner / investor briefings.</strong> Sections 02, 06 and 09 cover architecture, features, and moat in pitch-ready language.</li>
            </ol>
            <Callout variant="warn" icon={AlertTriangle} title="Read-only document">
              This is a reference. Technical controls live in the other admin panels: <Code>/admin/users</Code> for accounts, <Code>/admin/settings</Code> for feature flags, <Code>/admin/sniper-oversight</Code> for kill switch, etc.
            </Callout>
          </S>

          {/* 02 — Architecture */}
          <S id="architecture" n="02" title="Platform architecture" kicker="How it&apos;s built">
            <p>Naka Labs is a modern web application. No downloads, no extensions beyond the crypto wallets users already have. The stack is deliberately boring and widely-adopted because boring is reliable.</p>
            <KV items={[
              ['Frontend',       <>Next.js 14, React 18, Tailwind, TypeScript</>],
              ['Hosting',        <>Vercel (edge-deployed)</>],
              ['Database + Auth',<>Supabase (PostgreSQL + Row-Level Security)</>],
              ['Real-time',      <>Server-Sent Events (SSE) for the Context Feed; Supabase Realtime for user state</>],
              ['Cache + rate limiting', <>Upstash Redis</>],
              ['AI',             <>Anthropic Claude (Sonnet 4.6 for VTX, Opus 4.6 for deep analyses)</>],
              ['Observability',  <>Sentry (errors) + PostHog (product analytics)</>],
              ['Email',          <>Resend</>],
              ['Bot protection', <>Cloudflare Turnstile</>],
            ]} />
            <p>
              The whole thing runs in a standard modern browser. Mobile apps are in development; they will reuse the same APIs, so feature parity is automatic.
            </p>
            <H3>Why this stack, in a sentence each</H3>
            <Check><strong className="text-white">Next.js 14</strong> — gives us server-side rendering for SEO and edge-rendered APIs for speed.</Check>
            <Check><strong className="text-white">Supabase</strong> — Postgres with Row-Level Security means we get multi-tenant security as a default, not a bolt-on.</Check>
            <Check><strong className="text-white">Vercel edge</strong> — users anywhere in the world hit a server near them. First paint is fast even in Asia or Africa.</Check>
            <Check><strong className="text-white">Claude</strong> — state-of-the-art reasoning and tool use. Our VTX quality depends on it.</Check>
          </S>

          {/* 03 — Data flow */}
          <S id="dataflow" n="03" title="Data flow end-to-end" kicker="From click to screen">
            <p>
              A simple example: a user clicks &ldquo;Buy&rdquo; on a token. The journey looks like this:
            </p>
            <ol className="list-decimal pl-6 space-y-2 text-gray-300 text-[13px]">
              <li>The browser sends a signed request to our Next.js API route on Vercel.</li>
              <li>Our middleware verifies the Supabase JWT to confirm the user is logged in.</li>
              <li>We run a pre-flight security check on the destination token via GoPlus (honeypot, taxes, blacklist, unverified contract).</li>
              <li>If the scan passes, we fetch a live quote from the best DEX aggregator for that chain — 0x for EVM, Jupiter for Solana.</li>
              <li>A review modal pops up in the browser with the quote, price impact, fees, and minimum received.</li>
              <li>User taps Confirm. The transaction is built on the server and sent back to the browser for signing.</li>
              <li>The user&apos;s wallet — internal or external — signs it locally. We never see the private key.</li>
              <li>The signed transaction goes to Alchemy (EVM) or Helius (Solana) to be broadcast to the blockchain.</li>
              <li>Once confirmed on-chain, we increment platform counters, log the trade for the user&apos;s portfolio view, and stream the event into the Context Feed.</li>
            </ol>
            <Callout variant="ok" icon={CheckCircle} title="Single source of truth">
              Every data pipeline feeds the same cache. The price you see in the Context Feed is the same price VTX reasons over and the same price the swap engine quotes. There is no second system to sync.
            </Callout>
          </S>

          {/* 04 — Auth */}
          <S id="auth" n="04" title="Authentication" kicker="Who is this user, really">
            <p>
              All authentication goes through Supabase Auth using the <strong className="text-white">PKCE flow</strong> — the same flow Google, GitHub and Twitter use. The short version: the browser generates a secret, the server never sees the secret, and the server gives the browser a code that can only be redeemed if the browser still has the original secret. This prevents a whole category of credential-theft attacks.
            </p>
            <H3>What we store</H3>
            <Check>Email address (required).</Check>
            <Check>Password hash (bcrypt-style, never plaintext).</Check>
            <Check>JWT access token in an <Code>httpOnly, Secure, SameSite=lax</Code> cookie.</Check>
            <Check>Login timestamps + IP address for security audit.</Check>
            <H3>What we never store</H3>
            <Check>Plaintext password. You never told us, we never asked. Supabase hashes before persistence.</Check>
            <Check>Raw JWT in JavaScript-readable storage. Cookies are httpOnly so XSS cannot read them.</Check>
            <H3>Bot protection</H3>
            <p>Every signup and login is gated by Cloudflare Turnstile. Scrapers, credential-stuffing bots, and automated spam are blocked before reaching Supabase.</p>
          </S>

          {/* 05 — Wallet */}
          <S id="wallet" n="05" title="The non-custodial wallet" kicker="How we don&apos;t hold your keys">
            <p>
              This is the most-asked-about subsystem. The answer is simple: <strong className="text-white">we never see the keys</strong>. Here&apos;s exactly how that works.
            </p>
            <H3>Wallet creation</H3>
            <ol className="list-decimal pl-6 space-y-2 text-gray-300 text-[13px]">
              <li>User clicks &ldquo;Create wallet&rdquo;.</li>
              <li>The user&apos;s browser generates a BIP-39 mnemonic (12 random words) locally.</li>
              <li>The browser shows the mnemonic to the user once, with a big loud warning telling them to write it down physically.</li>
              <li>The browser derives an EVM private key and a Solana private key from the mnemonic using standard HD wallet paths.</li>
              <li>The user sets a password. The browser derives an encryption key from that password using <Code>PBKDF2 with 100,000 iterations of SHA-256</Code> and a per-wallet random salt.</li>
              <li>The browser encrypts the private keys with <Code>AES-256-GCM</Code>. What leaves the browser is ciphertext we cannot decrypt.</li>
              <li>The ciphertext is synced to Supabase&apos;s <Code>user_wallets_v2</Code> table. RLS ensures only the owner can read their row.</li>
            </ol>
            <H3>Wallet use (signing a transaction)</H3>
            <ol className="list-decimal pl-6 space-y-2 text-gray-300 text-[13px]">
              <li>User wants to swap. They enter their wallet password.</li>
              <li>Browser pulls ciphertext from Supabase.</li>
              <li>Browser decrypts locally using password-derived key.</li>
              <li>Browser signs the transaction in-memory.</li>
              <li>Plaintext key is immediately zeroed.</li>
              <li>Signed transaction goes to Alchemy / Helius for broadcast.</li>
            </ol>
            <Callout variant="ok" icon={Lock} title="What this means operationally">
              If Naka Labs is compromised tomorrow, user funds are not at risk. The attacker would have ciphertext they cannot decrypt without passwords we never stored. This is non-negotiable — it&apos;s why we built the platform this way.
            </Callout>
            <Callout variant="warn" icon={AlertTriangle} title="What we cannot do">
              We cannot recover a lost password. We cannot recover a lost seed phrase. We cannot unlock a wallet if the user forgets both. &ldquo;Can&apos;t you restore my wallet&rdquo; is the single hardest user email we receive — the answer is always no, and section 10 explains how to communicate that with empathy.
            </Callout>
          </S>

          {/* 06 — Feature deep-dives */}
          <S id="features" n="06" title="Feature deep-dives" kicker="Plain-English explainers">
            <H3 children={<><Brain className="inline w-4 h-4 mr-1 text-[#4D6BFF]" />VTX AI Agent</>} />
            <p>
              VTX is a wrapper around Anthropic&apos;s Claude model. Unlike ChatGPT-style chatbots, VTX has <strong className="text-white">tool use</strong> — it can directly call our on-chain APIs during the conversation. So when a user asks &ldquo;what is this wallet buying&rdquo;, VTX doesn&apos;t invent an answer from training data; it queries Alchemy live, gets the answer, and formats it in English.
            </p>
            <p>
              VTX has about 30 slash commands (<Code>/price</Code>, <Code>/wallet</Code>, <Code>/whale</Code>, etc.) that preload the right tool call. Power users type commands; everyone else just asks in English.
            </p>

            <H3 children={<><Activity className="inline w-4 h-4 mr-1 text-[#10B981]" />Context Feed</>} />
            <p>
              A real-time stream of classified on-chain events. Four parallel data streams feed it:
            </p>
            <Check>CoinGecko — market-wide movements, trending tokens, new listings.</Check>
            <Check>Alchemy + Solana RPC — whale transfers large enough to move markets.</Check>
            <Check>DexScreener — liquidity drops, pump.fun new launches, momentum spikes.</Check>
            <Check>Birdeye — Solana-specific trending.</Check>
            <p>
              A scoring function combines recency, trust score, USD size, and anti-spam penalties. Users see only the top-ranked events for their watchlist chains.
            </p>

            <H3 children={<><TrendingUp className="inline w-4 h-4 mr-1 text-[#F59E0B]" />Whale Tracker</>} />
            <p>
              We monitor about 1,000 wallets across 10 chains. When any of them transact, the event is pushed to our backend via Alchemy/Helius webhooks. Our server classifies the wallet (mega/large/mid/small), calculates the 24h PnL, and fans out the event to every user who follows that wallet via Supabase Realtime.
            </p>

            <H3 children={<><Users className="inline w-4 h-4 mr-1 text-[#8B5CF6]" />Smart Money & Wallet Clusters</>} />
            <p>
              Smart Money is an <em>algorithmic</em> classification — wallets are scored on win rate, risk-adjusted PnL, consistency, and timing. The top scorers are flagged Smart Money and can exit the pool if their performance drops. Wallet Clusters uses graph analysis: wallets that transact together frequently, fund each other, or move in lockstep are grouped into clusters.
            </p>

            <H3 children={<><Crosshair className="inline w-4 h-4 mr-1 text-[#EF4444]" />Sniper Bot</>} />
            <p>
              Max-tier only. The Sniper Bot watches for newly launched tokens, runs a 5-layer safety check, and — if the user&apos;s criteria match and auto-execute is on — submits a buy transaction. The safety stack: GoPlus honeypot, tax threshold, liquidity lock, ownership renouncement, holder concentration. A kill switch in <Code>/admin/sniper-oversight</Code> stops all active snipes platform-wide in one click.
            </p>

            <H3 children={<><Repeat className="inline w-4 h-4 mr-1 text-[#06B6D4]" />Swap Engine</>} />
            <p>
              The swap engine aggregates every major DEX on each chain and picks the best route. 0x Protocol handles EVM; Jupiter handles Solana. The user sees a single quote; underneath, the quote is assembled from multiple liquidity sources. A 0.4% platform fee is charged on each swap, disclosed upfront and included in the displayed receive amount.
            </p>

            <H3 children={<><BarChart3 className="inline w-4 h-4 mr-1 text-[#10B981]" />On-Chain Trends</>} />
            <p>
              Aggregates network-wide metrics — DeFi TVL, stablecoin flows, gas trends, active addresses, cross-chain capital migration — into a single &ldquo;network pulse&rdquo; view. Sparklines with 24h/7d deltas. Auto-alerts when any tracked metric moves more than 10% in 24 hours.
            </p>

            <H3 children={<><Network className="inline w-4 h-4 mr-1 text-[#EC4899]" />Bubble Map</>} />
            <p>
              A force-directed graph (D3.js) of any token&apos;s top holders. Node size scales with holding amount. The central token bubble colours green or red based on 24h price move. Three modes: holders, network (wallet-to-wallet edges), and cluster (group by type — whale, exchange, insider, team).
            </p>
          </S>

          {/* 07 — Security */}
          <S id="security" n="07" title="Security infrastructure" kicker="Defence in depth">
            <p>
              Security is the most credible differentiator we have. It is applied in layers — every layer is a net the next one doesn&apos;t have to catch. Understanding the layers is important because it&apos;s the core pitch.
            </p>

            <H3>Layer 1 — GoPlus token scanning</H3>
            <p>
              <strong className="text-white">GoPlus Security</strong> is one of the most widely-adopted token-audit engines in crypto. We run it automatically before every swap, snipe, VTX mention, and bubble map render. It checks for honeypots, hidden taxes, blacklists, unverified contracts, and dozens of other red flags.
            </p>
            <KV items={[
              ['Applied in', <>Swap engine, Sniper Bot, VTX Agent, Context Feed, Bubble Map</>],
              ['Latency',    <>~150-300ms per token</>],
              ['Fallback',   <>If GoPlus is unreachable, surface a neutral flag and never fail-open on high-risk actions</>],
            ]} />

            <H3>Layer 2 — Shadow Guardian (pre-trade simulation)</H3>
            <p>
              Before any swap broadcasts to chain, we simulate it on a fork. If the token prevents selling — the defining signature of a honeypot — the trade aborts automatically. No gas is spent. Runs in under 200ms.
            </p>

            <H3>Layer 3 — Wallet encryption (AES-256-GCM)</H3>
            <p>
              See section 05 for the full mechanics. Summary: internal wallet keys are encrypted client-side with AES-256-GCM using a PBKDF2-derived key. We store ciphertext only.
            </p>

            <H3>Layer 4 — Supabase Row-Level Security (RLS)</H3>
            <p>
              Every user-data table enforces RLS. The policy is: a row with <Code>user_id = X</Code> can only be read or modified by the authenticated session for user <Code>X</Code>. Admin-side operations use a separate service-role key that never reaches the browser.
            </p>

            <H3>Layer 5 — JWT verification + secure cookies</H3>
            <p>
              Every protected route verifies the Supabase JWT in middleware before the route handler runs. Cookies are <Code>httpOnly</Code> (JavaScript cannot read them), <Code>Secure</Code> (HTTPS only), <Code>SameSite=lax</Code> (CSRF-resistant).
            </p>

            <H3>Layer 6 — Cloudflare Turnstile</H3>
            <p>
              Login and signup are gated by Turnstile, Cloudflare&apos;s privacy-preserving CAPTCHA alternative. This blocks credential-stuffing bots, automated scrapers, and mass-account creation.
            </p>

            <H3>Layer 7 — Rate limiting</H3>
            <p>
              Every sensitive endpoint (auth, swap, AI) is rate-limited per IP and per user via Upstash Redis. Free users get lower limits; paid tiers get higher. Crossing the limit returns <Code>429 Too Many Requests</Code>.
            </p>

            <H3>Layer 8 — Sentry + PostHog observability</H3>
            <p>
              Every unhandled error is captured in Sentry with PII stripped. PostHog tracks feature usage and surfaces anomalies. Security-relevant events (failed logins, approval bursts, new-device sessions) are flagged for review.
            </p>

            <Callout variant="danger" icon={AlertTriangle} title="What security cannot do">
              All of the above reduces risk. None of it eliminates risk. Smart contracts get exploited after security audits. Centralised exchanges get hacked. Users lose seed phrases. Always frame security as a floor, not a guarantee.
            </Callout>
          </S>

          {/* 08 — Providers */}
          <S id="providers" n="08" title="Data sources & providers" kicker="Who we pay, and why">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
              {[
                { title: 'Alchemy',    role: 'EVM chain data, whale webhooks', why: 'Best latency on Ethereum, Base, Arbitrum, Polygon, BNB, Avalanche, Optimism.' },
                { title: 'Helius',     role: 'Solana chain data, webhooks',    why: 'The Alchemy-equivalent for Solana. Used for SPL token data and SOL transactions.' },
                { title: 'CoinGecko',  role: 'Market data (prices, trending)', why: 'Most trusted crypto price aggregator. Feeds dashboard + Context Feed.' },
                { title: 'Birdeye',    role: 'Solana token trending',          why: 'Best coverage of Solana memecoin momentum.' },
                { title: 'GoPlus',     role: 'Token security audits',          why: 'Widest token coverage + fastest response for honeypot/tax checks.' },
                { title: 'DexScreener',role: 'Liquidity, pump.fun detection',  why: 'Real-time DEX tick data + early-launch discovery.' },
                { title: 'LunarCrush', role: 'Social sentiment & momentum',    why: 'Quantifies social attention for VTX&apos;s &quot;what is trending&quot; answers.' },
                { title: 'Anthropic',  role: 'Claude API for VTX',             why: 'Best-in-class reasoning + tool use. Sonnet for most queries, Opus for deep analysis.' },
                { title: 'Supabase',   role: 'Database + auth',                why: 'Postgres with RLS + managed auth in one. Reduces infra surface.' },
                { title: 'Vercel',     role: 'Hosting + edge',                 why: 'Next.js-native hosting with global edge.' },
                { title: 'Upstash',    role: 'Redis cache + rate limiting',    why: 'Serverless Redis; pay-per-request fits our usage pattern.' },
                { title: 'Cloudflare', role: 'Turnstile bot protection',       why: 'Privacy-first CAPTCHA alternative.' },
                { title: 'Sentry',     role: 'Error tracking',                 why: 'Industry standard; catches exceptions with stack traces.' },
                { title: 'PostHog',    role: 'Product analytics',              why: 'Self-hostable, privacy-compliant analytics.' },
                { title: 'Resend',     role: 'Transactional email',            why: 'Developer-friendly email API with high deliverability.' },
              ].map((p) => (
                <div key={p.title} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-sm font-bold text-white">{p.title}</div>
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide mt-0.5">{p.role}</div>
                  <div className="text-[12.5px] text-gray-400 mt-2 leading-relaxed">{p.why}</div>
                </div>
              ))}
            </div>
            <Callout variant="info" icon={Sparkles} title="Public-facing positioning">
              In user-facing UI, VTX and the docs refer to all of the above as &ldquo;Naka Labs Intelligence.&rdquo; This is deliberate: our moat is the integration, not the providers. Providers are implementation details. Do not list them publicly unless specifically asked — and then only in Section 4.2 of the whitepaper does that detail appear.
            </Callout>
          </S>

          {/* 09 — Moat */}
          <S id="moat" n="09" title="What makes us better" kicker="The moat, spelled out">
            <p>
              Every piece of what we do exists somewhere else. What nobody else has is the <em>combination</em>: a single real-time data pipeline feeding intelligence, security, execution and analytics — delivered in one product at retail pricing. Specifically:
            </p>

            <H3>1. One source of truth, everywhere</H3>
            <p>
              Nansen has better whale analytics. Arkham has better labelling. Dune has deeper SQL. But each of them is a silo. In Naka, the same whale feed powers the Context Feed, VTX, the Bubble Map, and Copy Trading. The number you see in one place is the number you see in every place. Competitors can&apos;t copy this without rebuilding their entire pipeline.
            </p>

            <H3>2. Security at every entry point (not as a separate tab)</H3>
            <p>
              GoPlus runs beneath every swap, snipe, VTX query and bubble render — automatically. Competitors offer security as a separate scanner; users forget to use it. We make it the default path. You cannot accidentally skip it.
            </p>

            <H3>3. AI that actually does the work</H3>
            <p>
              Most &ldquo;AI crypto&rdquo; products are chat interfaces on top of stale data. VTX uses Claude&apos;s native tool-use: the model can directly call our live on-chain APIs during a conversation. It renders working TokenCards and SwapCards inside the chat. You can complete a swap without leaving the message.
            </p>

            <H3>4. Non-custodial by default</H3>
            <p>
              Every convenience-first wallet service introduces custody. We refused. It&apos;s harder to build, harder to recover from user error, and it&apos;s the only reason users can trust us with their money.
            </p>

            <H3>5. Priced for retail, built for pros</H3>
            <p>
              The equivalent institutional stack (Nansen + Arkham + Dune + Glassnode + TradingView Pro + DeBank) costs $500+ /month. Naka Labs Pro is $9. The bet is: breadth of users beats depth of pricing. We&apos;d rather serve 100,000 traders at $9 than 500 funds at $2,000.
            </p>

            <H3>6. No vendor lock-in</H3>
            <p>
              Every insight links to verifiable on-chain data. Every swap routes through standard DEX aggregators. Wallet keys are standard BIP-39 mnemonics. You can leave and take everything with you — which is the only honest way to build a platform.
            </p>

            <Callout variant="info" icon={Sparkles} title="Differentiators against the big names (admin-only)">
              <strong className="text-white">vs. Nansen:</strong> cheaper + security-first + non-custodial wallet built in + multi-chain parity (Nansen is EVM-heavy). <br />
              <strong className="text-white">vs. Arkham:</strong> better execution layer (they have labels, we have swap/snipe) + AI native (they don&apos;t). <br />
              <strong className="text-white">vs. Dune:</strong> dashboard-over-time vs our real-time; we don&apos;t need SQL fluency. <br />
              <strong className="text-white">vs. DeBank:</strong> we have on-chain intelligence, they have portfolio tracking. <br />
              <strong className="text-white">vs. GMGN / Maestro:</strong> full platform vs a trading bot + basic chart. <br />
              <em>Do not name competitors publicly. These comparisons are for press, investors and internal prep only.</em>
            </Callout>
          </S>

          {/* 10 — Troubleshooting */}
          <S id="troubleshoot" n="10" title="CEO troubleshooting guide" kicker="When something goes wrong">
            <p>
              If a user DMs you or posts a complaint in the Space, these are the symptoms you&apos;ll see most often and the exact checks to run. You do not need to fix anything yourself — just triage to the right admin panel or escalate to the dev team.
            </p>

            <Troubleshoot
              symptom="The platform is down / pages aren&apos;t loading"
              checks={[
                'Check Vercel status: vercel-status.com',
                'Check Supabase status: status.supabase.com',
                'Open /admin/api-health — is any provider red?',
                'Try https://nakalabs.xyz yourself in an incognito browser window',
              ]}
              action="If Vercel or Supabase is down, post a holding tweet acknowledging the issue and link to the provider status page. If only Naka is down, ping the dev team immediately with the error output from /admin/api-health."
            />

            <Troubleshoot
              symptom="My wallet disappeared / I can&apos;t access my funds"
              checks={[
                'Ask which device and browser they are using. Wallet data is per-device unless cloud-synced.',
                'Ask if they created the wallet via Naka or imported an external wallet (MetaMask/Phantom).',
                'Open /admin/users, search their email, check the user_wallets_v2 ciphertext count.',
                'If ciphertext exists: their funds are recoverable by them with the correct password + seed phrase.',
                'If no ciphertext: either they never created a wallet, or they\u2019re signed into the wrong account.',
              ]}
              action="Funds cannot be recovered by us. Politely confirm they have their seed phrase written down, and walk them through the import flow on any device. If they&apos;ve lost the seed: there is nothing we can do — explain our non-custodial model kindly."
            />

            <Troubleshoot
              symptom="I can&apos;t log in"
              checks={[
                'Check /admin/users — does their account exist and is not banned?',
                'Check /admin/logs for recent failed logins from their email.',
                'Ask if they&apos;re seeing the Turnstile challenge — if not, their browser may be blocking it.',
                'Is Supabase auth healthy? status.supabase.com',
              ]}
              action="Most issues: password reset. Send them to /forgot-password. If Turnstile is failing, tell them to disable browser extensions (ad-blockers often block it). If Supabase is down, tell them to wait."
            />

            <Troubleshoot
              symptom="Prices are wrong / The chart is frozen"
              checks={[
                'Open /admin/api-health and check CoinGecko + DexScreener status.',
                'Check if we\u2019re rate-limited — look for 429 errors in Sentry.',
                'Has CoinGecko announced an outage? Twitter @coingecko.',
              ]}
              action="If we&apos;re rate-limited, the dev team needs to upgrade the CoinGecko plan. If CoinGecko itself is down, we degrade gracefully — show a banner: &ldquo;Market data temporarily delayed.&rdquo;"
            />

            <Troubleshoot
              symptom="Whale Tracker is empty / Not updating"
              checks={[
                'Check /admin/api-health for Alchemy and Helius.',
                'Check if the user is on the right chain and tier. Whale Tracker requires Mini+ for live view.',
                'Check Supabase Realtime status.',
              ]}
              action="If Alchemy/Helius webhooks are down, no new events flow. Dev team can restart webhook listeners. If it&apos;s a tier-gate issue, check their subscription in /admin/users."
            />

            <Troubleshoot
              symptom="VTX Agent is slow / Not responding"
              checks={[
                'Check Anthropic API status: status.anthropic.com',
                'Check /admin/vtx-analytics for recent error rate.',
                'Is the user on free tier and rate-limited (25 messages/day)?',
              ]}
              action="If Anthropic is down, there&apos;s nothing we can do — post a holding message. If only one user is affected and they&apos;re rate-limited, invite them to upgrade. If we see a platform-wide error spike, escalate to dev team."
            />

            <Troubleshoot
              symptom="My swap failed / I lost gas"
              checks={[
                'Ask for the transaction hash.',
                'Look up the tx on Etherscan / Solscan directly.',
                'Common failure reasons: slippage exceeded, token became a honeypot mid-trade, user cancelled on wallet side.',
              ]}
              action="If on-chain shows a revert due to slippage: explain slippage, invite them to retry with higher slippage tolerance. If the token was flagged by Shadow Guardian: celebrate — we just saved them. If it&apos;s a true platform bug: escalate to dev with the tx hash."
            />

            <Troubleshoot
              symptom="Sniper Bot isn&apos;t firing"
              checks={[
                'Check /admin/sniper-oversight — is the kill switch on?',
                'Check the user&apos;s criteria — are they too narrow (no tokens match)?',
                'Check user tier — Sniper requires Max.',
              ]}
              action="If kill switch is on, there&apos;s a safety reason — check recent incidents before flipping off. If criteria are the issue, walk the user through loosening them. If tier, invite upgrade."
            />
          </S>

          {/* 11 — Access */}
          <S id="access" n="11" title="User access & tier controls" kicker="Who can do what">
            <p>Four tiers. Enforced everywhere via a <Code>withTierGate()</Code> wrapper + <Code>checkTier()</Code> helper. Never read <Code>user.tier</Code> directly.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
              {[
                { name: 'Free',  price: '$0',      color: '#9CA3AF', access: 'Basic intelligence, 25 VTX/day, 3 price alerts, 1 wallet, standard swap' },
                { name: 'Mini',  price: '$5 / mo', color: '#0A1EFF', access: 'Full wallet intel, 100 VTX/day, 10 alerts, whale tracker (view), DNA analyzer, 3 wallets' },
                { name: 'Pro',   price: '$9 / mo', color: '#10B981', access: 'Unlimited VTX, gasless swap, one-click copy trading, bubble map, wallet clusters, 10 wallets' },
                { name: 'Max',   price: '$15/ mo', color: '#F59E0B', access: 'Sniper Bot, auto-copy trading, unlimited wallets, priority support, early access' },
              ].map((t) => (
                <div key={t.name} className="bg-white/[0.02] border rounded-xl p-4" style={{ borderColor: t.color + '30' }}>
                  <div className="flex items-baseline justify-between mb-1">
                    <div className="text-base font-bold text-white">{t.name}</div>
                    <div className="text-sm font-mono" style={{ color: t.color }}>{t.price}</div>
                  </div>
                  <div className="text-[13px] text-gray-400">{t.access}</div>
                </div>
              ))}
            </div>
            <H3>Tier expiry</H3>
            <p>
              Handled by <Code>effectiveTier()</Code> in <Code>lib/hooks/useAuth.ts</Code>. If a paid tier has expired, the user drops to Free automatically. Never hardcode tier checks.
            </p>
          </S>

          {/* 12 — Admin actions */}
          <S id="admin-actions" n="12" title="Admin actions — what&apos;s in which panel" kicker="Operator handbook">
            <div className="space-y-2 my-4">
              {[
                { path: '/admin/dashboard',          what: 'Live platform metrics — users, scans, fees, active positions' },
                { path: '/admin/users',              what: 'Search any user, view subscription, ban / unban' },
                { path: '/admin/revenue',            what: 'Real fee collection data + CSV export' },
                { path: '/admin/api-health',         what: 'Real ping tests for every data provider — first-stop for incident triage' },
                { path: '/admin/sniper-oversight',   what: 'Sniper executions history + platform-wide kill switch' },
                { path: '/admin/security-analytics', what: 'Token scan history, blocked trades, flagged contracts' },
                { path: '/admin/settings',           what: 'Feature flags + maintenance mode + banner announcement' },
                { path: '/admin/broadcast',          what: 'Compose and send platform-wide notifications / emails' },
                { path: '/admin/announcements',      what: 'Manage the banner that appears in the dashboard' },
                { path: '/admin/research',           what: 'Full CMS — write, edit, publish research posts' },
                { path: '/admin/support',            what: 'Ticket inbox — reply, change status, add internal notes' },
                { path: '/admin/email-templates',    what: 'Transactional email templates' },
                { path: '/admin/treasury',           what: 'Live treasury wallet balances (EVM + Solana)' },
                { path: '/admin/watchlist-insights', what: 'What tokens users are watching — useful for product decisions' },
                { path: '/admin/search-logs',        what: 'Raw search queries — signal for missing features / content' },
                { path: '/admin/wallet-labels',      what: 'CRUD on our whale / exchange / team label database' },
                { path: '/admin/featured-tokens',    what: 'Tokens promoted in the swap page Popular tab' },
              ].map((a) => (
                <div key={a.path} className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.05] rounded-lg px-4 py-2.5">
                  <Code>{a.path}</Code>
                  <div className="text-[13px] text-gray-400 flex-1 min-w-0">{a.what}</div>
                </div>
              ))}
            </div>
          </S>

          {/* 13 — Spaces */}
          <S id="spaces" n="13" title="Speaking on X Spaces" kicker="Talk-track for common questions">
            <p>When you&apos;re live, you won&apos;t have time to think. Use these phrasings — they&apos;re short, true, and sound confident.</p>

            <H4>&ldquo;How is Naka Labs different from Nansen or Arkham?&rdquo;</H4>
            <p className="text-gray-300">
              &ldquo;Nansen and Arkham are analytics silos. Great for research, but you leave them to act. Naka unifies intelligence with execution — same data feeds the whale feed, the AI agent, the security scanner, and the swap engine. So you see a signal, verify it, and execute without switching tabs. And we&apos;re $9 a month where they&apos;re thousands.&rdquo;
            </p>

            <H4>&ldquo;Are you custodying my funds?&rdquo;</H4>
            <p className="text-gray-300">
              &ldquo;No. Never. Your private keys are encrypted in your browser with AES-256-GCM before they ever touch our servers. If Naka got hacked tomorrow, attackers would get ciphertext they can&apos;t decrypt. We don&apos;t hold your keys because we shouldn&apos;t — you should.&rdquo;
            </p>

            <H4>&ldquo;Can you really block every rug pull?&rdquo;</H4>
            <p className="text-gray-300">
              &ldquo;No platform can. What we can do is run GoPlus on every token before you interact, simulate every swap before it broadcasts, and colour-code price impact before you sign. We reduce risk with every tool we ship. We don&apos;t promise zero because that&apos;s a lie.&rdquo;
            </p>

            <H4>&ldquo;What&apos;s your AI doing that ChatGPT isn&apos;t?&rdquo;</H4>
            <p className="text-gray-300">
              &ldquo;Our AI has tools. When you ask about a token, VTX calls our live on-chain APIs in real time. ChatGPT uses training data from months ago. We return the current price, current holder structure, current risk. You can finish a swap inside the VTX chat. It&apos;s not a chatbot, it&apos;s a trading copilot.&rdquo;
            </p>

            <H4>&ldquo;When is your mobile app?&rdquo;</H4>
            <p className="text-gray-300">
              &ldquo;In active development. We don&apos;t publish dates because we&apos;d rather ship than promise. Follow us and you&apos;ll know the week it drops.&rdquo;
            </p>

            <H4>&ldquo;What about your token / DAO?&rdquo;</H4>
            <p className="text-gray-300">
              &ldquo;DAO governance is starting soon. Early contributors, Max subscribers, and pre-raise NFT holders will be the first voting pool. We&apos;re designing the rules right now. Nothing public to announce on the token specifically until everything is finalised.&rdquo;
            </p>

            <H4>&ldquo;Why should I trust you vs the hundred other AI crypto apps?&rdquo;</H4>
            <p className="text-gray-300">
              &ldquo;Ship speed and depth. Try VTX for five minutes. Ask it to audit a sketchy contract. Ask it to find the top memecoin convergence in the last hour. Then try that on any competitor. The difference is visible in minutes.&rdquo;
            </p>

            <Callout variant="warn" icon={AlertTriangle} title="Things to never say publicly">
              <ul className="list-disc pl-5 space-y-1">
                <li>Never name the data providers (Alchemy, Helius, GoPlus, CoinGecko) — we position them as &ldquo;Naka Labs Intelligence.&rdquo;</li>
                <li>Never commit to dates. &ldquo;Coming soon&rdquo; always; &ldquo;next month&rdquo; never.</li>
                <li>Never give financial advice. Always &ldquo;do your own research.&rdquo;</li>
                <li>Never comment on live investigations or partnerships that haven&apos;t been publicly announced.</li>
                <li>Never say the platform is 100% safe. Say &ldquo;we reduce risk at every layer.&rdquo;</li>
              </ul>
            </Callout>
          </S>

          {/* 14 — NFT */}
          <S id="nft" n="14" title="NFT pre-raise fund — plan" kicker="Not yet live">
            <p>
              A small, limited NFT collection exists only as a <strong className="text-white">pre-raise funding mechanism</strong> for platform build-out. It is <em>not</em> the main Naka Labs token and should never be confused with one.
            </p>
            <H3>Mechanics (when launched)</H3>
            <ol className="list-decimal pl-6 space-y-1 text-gray-300 text-[13px]">
              <li>Fixed supply, mint price set at launch.</li>
              <li>Holders get early access to new features, priority support escalation, and a portion of platform fee revenue share (terms finalising with legal).</li>
              <li>Holders are also the initial DAO voting pool alongside Max subscribers.</li>
              <li>Detection is passive: platform reads the wallet, checks on-chain ownership, applies benefits automatically.</li>
            </ol>
            <H3>Status</H3>
            <Check>Contract: not yet deployed.</Check>
            <Check>Mint UI: not yet built.</Check>
            <Check>Tab in platform: hidden until launch.</Check>
            <Check>Public announcement: after legal clears structure.</Check>
            <Callout variant="warn" icon={AlertTriangle} title="Never discuss specifics yet">
              Do not give mint price, supply, drop date, or revenue share percentages publicly. Any number mentioned becomes a commitment we can&apos;t walk back. Until legal signs off, the answer is: &ldquo;details close to launch.&rdquo;
            </Callout>
          </S>

          {/* Footer */}
          <div className="pt-6 mt-10 border-t border-white/[0.06] text-xs text-gray-500">
            <p>Internal document · Admins only · Do not share externally. Last updated April 2026.</p>
          </div>
        </main>
      </div>
    </div>
  );
}
