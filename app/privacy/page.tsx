import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy · Naka Labs',
  description: 'How Naka Labs collects, uses, and protects your data.',
};

function H2({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <h2 className="text-xl sm:text-2xl font-bold text-white mt-12 mb-4 flex items-baseline gap-3 scroll-mt-24" id={n}>
      <span className="text-3xl font-black text-white/[0.06] font-mono select-none">{n}</span>
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-bold text-white mt-6 mb-2">{children}</h3>;
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#080C18] text-white">
      <div className="sticky top-0 z-40 bg-[#080C18]/98 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="w-4 h-4 text-[#10B981]" />
            Privacy Policy
          </div>
          <Link href="/terms" className="text-xs text-gray-400 hover:text-white">Terms</Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-[15px] leading-[1.75] text-gray-300">
        <div className="mb-12 pb-8 border-b border-white/[0.06]">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">Privacy Policy</h1>
          <p className="text-gray-500 text-sm">Last updated: April 2026 · Version 1.0</p>
          <p className="text-gray-400 mt-4">
            This Privacy Policy explains what personal data Naka Labs collects, how we use it, how we protect it, and the rights you have. It applies to every part of the Naka Labs platform, including the web app, the Telegram bot, and any API access.
          </p>
        </div>

        <H2 n="01">What We Collect</H2>
        <H3>Account information</H3>
        <p>When you create an account we collect your email address, a password hash (never the plaintext), your chosen display name (optional), subscription tier, and account creation timestamp. Login timestamps and IP addresses are stored for security audit purposes.</p>
        <H3>Wallet addresses</H3>
        <p>We store the public wallet addresses you choose to associate with your account. These are public on-chain data · we do not treat them as secret, but we do protect them with Row-Level Security so only your own account session can read or modify your address list.</p>
        <H3>Usage and analytics</H3>
        <p>PostHog captures anonymized page views, feature-usage events, and error occurrences to help us improve the platform. Sentry captures JavaScript errors including stack traces. Neither service receives your private keys, wallet passwords, or plaintext wallet data.</p>
        <H3>Platform content</H3>
        <p>Your VTX chat history, watchlists, follows, alerts, bookmarks, research drafts, and similar user-generated content are stored so the platform can serve them back to you across sessions and devices.</p>
        <H3>Communications</H3>
        <p>If you link a Telegram account, we store your Telegram chat ID so we can deliver notifications you opt into. If you contact support, we store the message thread.</p>

        <H2 n="02">What We Never Collect</H2>
        <ul className="list-disc pl-6 space-y-2 my-4 text-gray-300">
          <li><strong>Your seed phrase.</strong> Generated in your browser, shown to you once for backup, and never transmitted to our servers. We have no copy.</li>
          <li><strong>Your private keys.</strong> Derived from your seed in your browser, encrypted locally with AES-256-GCM before any sync. We store ciphertext we cannot decrypt.</li>
          <li><strong>Your wallet password.</strong> Used in your browser to derive the encryption key. Never transmitted.</li>
          <li><strong>Your social DMs or private social-platform data.</strong> We do not hook into your Telegram, X, Discord, or any other service beyond the explicit, per-service integrations you authorise.</li>
          <li><strong>Unnecessary personally identifiable information.</strong> We do not ask for government ID, phone numbers, home addresses, or date of birth. If that changes for any regulated feature, we will ask you explicitly at the point of feature use.</li>
        </ul>

        <H2 n="03">How We Use Your Data</H2>
        <p>We use your data to:</p>
        <ul className="list-disc pl-6 space-y-2 my-4 text-gray-300">
          <li>Operate and deliver the platform features you access.</li>
          <li>Personalise your experience · VTX context, your feed, your watchlists.</li>
          <li>Send you transactional messages you opt into (alerts, security warnings, account notices).</li>
          <li>Detect and prevent fraud, abuse, and security incidents.</li>
          <li>Comply with legal obligations.</li>
          <li>Measure aggregate usage so we can improve the product.</li>
        </ul>
        <p>We do not sell your personal data. We do not rent it. We do not share it with advertising networks.</p>

        <H2 n="04">How We Protect Your Data</H2>
        <H3>Infrastructure</H3>
        <p>The platform runs on Vercel edge infrastructure with data stored in Supabase (PostgreSQL). Every Supabase table that contains user data has Row-Level Security policies restricting reads and writes to authenticated users, and admin-side operations use a separate service-role key that never reaches the browser.</p>
        <H3>Authentication</H3>
        <p>Authentication uses Supabase&apos;s PKCE flow with JWT access tokens stored in httpOnly, Secure, SameSite=lax cookies. Middleware verifies every protected-route request. Signup and login are gated by Cloudflare Turnstile to limit automated abuse.</p>
        <H3>Wallet encryption</H3>
        <p>Internal wallet private keys are encrypted client-side with AES-256-GCM using a 256-bit key derived from your password via PBKDF2 (100,000 rounds of SHA-256) and a per-wallet random salt. Only opaque ciphertext reaches our database.</p>
        <H3>Monitoring</H3>
        <p>Errors are tracked in Sentry with sensitive fields stripped. Access patterns are monitored via PostHog and internal logs. Security-relevant events (failed logins, unusual access patterns, approvals from new devices) are logged for audit.</p>

        <H3>VTX Agent &amp; your wallet</H3>
        <p>VTX Agent can read your connected wallet's public address so it can quote swaps, display balances, and reason about your portfolio. It cannot read your private key, your seed phrase, or your password — those never leave your device. VTX is an advisory layer: it cannot withdraw funds, transfer tokens, approve allowances, or execute any on-chain action. Every swap, send, or approval requires a fresh signature prompt from your wallet, triggered only by your explicit tap of "Sign &amp; Swap" (or equivalent). If you prefer VTX not to see your wallet address at all, disconnect the wallet from the Wallet page before chatting.</p>

        <H2 n="05">Data Sharing</H2>
        <p>We share your data only with the third-party providers required to operate the platform, under contracts that constrain their use of that data to operating their service:</p>
        <ul className="list-disc pl-6 space-y-2 my-4 text-gray-300">
          <li><strong>Infrastructure:</strong> Vercel (hosting), Supabase (database), Cloudflare (CDN &amp; bot protection), Upstash (Redis rate-limiting cache).</li>
          <li><strong>Data providers:</strong> CoinGecko, Alchemy, Helius, Birdeye, DexScreener, GoPlus, LunarCrush. We pass public on-chain identifiers (addresses, token IDs) · not your personal data · to these providers.</li>
          <li><strong>AI:</strong> Anthropic Claude for VTX responses. We send only the chat content and relevant tool-call payloads. We do not send wallet passwords, seed phrases, or secrets.</li>
          <li><strong>Analytics &amp; error tracking:</strong> PostHog (usage analytics, anonymized), Sentry (error reporting, PII stripped).</li>
          <li><strong>Email:</strong> Resend for transactional email delivery.</li>
          <li><strong>Payments:</strong> On-chain crypto rails (no third-party processor holds funds).</li>
        </ul>
        <p>We will share data if required by a valid legal process (subpoena, court order, regulatory requirement), and only to the extent required. We will notify affected users unless prohibited by law.</p>

        <H2 n="06">Data Retention</H2>
        <p>Account data is retained while your account is active and for 30 days after account deletion, except where longer retention is required by law. Transactional records (on-chain transactions, payments) may be retained longer per financial record-keeping requirements. Aggregate analytics data is retained in anonymized form indefinitely.</p>
        <p>Backups are encrypted and rotated every 30 days.</p>

        <H2 n="07">Your Rights</H2>
        <p>Depending on your jurisdiction, you have some or all of the following rights:</p>
        <ul className="list-disc pl-6 space-y-2 my-4 text-gray-300">
          <li><strong>Access:</strong> request a copy of the personal data we hold about you.</li>
          <li><strong>Rectification:</strong> correct any inaccurate or incomplete personal data.</li>
          <li><strong>Erasure:</strong> request deletion of your personal data, subject to our legal retention obligations.</li>
          <li><strong>Portability:</strong> receive your data in a machine-readable format.</li>
          <li><strong>Restriction:</strong> limit our processing in certain circumstances.</li>
          <li><strong>Objection:</strong> object to certain processing (e.g., analytics).</li>
          <li><strong>Withdrawal of consent:</strong> for any processing based on consent.</li>
          <li><strong>Do Not Sell / Share (CCPA):</strong> we already do not sell or share your personal data; you do not need to opt out, but you may confirm this at any time.</li>
        </ul>
        <p>Most of these can be exercised directly from Settings → Account. For anything not available there, email <a href="mailto:privacy@nakalabs.xyz" className="text-[#4D6BFF] hover:underline">privacy@nakalabs.xyz</a>. We will respond within 30 days.</p>

        <H2 n="08">Cookies &amp; Similar Technologies</H2>
        <p>We use cookies and browser storage for essential functionality: session authentication, Turnstile bot protection, preference persistence, and encrypted wallet caching. We do not use advertising cookies or cross-site tracking. A detailed breakdown of each cookie is available on request.</p>

        <H2 n="09">International Transfers</H2>
        <p>Our infrastructure providers operate globally. Your data may be stored and processed in regions different from your own. Where data is transferred across borders, we rely on standard contractual clauses or equivalent safeguards permitted by applicable law.</p>

        <H2 n="10">Children&apos;s Privacy</H2>
        <p>The platform is not directed at children under 18. We do not knowingly collect personal data from anyone under 18. If we discover data belonging to a minor, we will delete it.</p>

        <H2 n="11">Breach Notification</H2>
        <p>If we discover a breach that compromises your personal data, we will notify affected users and relevant regulators within 72 hours of confirmation, as required by GDPR and similar frameworks. Notifications will describe what happened, what data was affected, what we are doing, and what you should do.</p>

        <H2 n="12">Changes to This Policy</H2>
        <p>We may update this Privacy Policy to reflect changes in our practices, infrastructure, or the law. Material changes will be announced in-platform and take effect 30 days after announcement. Continued use after the effective date constitutes acceptance.</p>

        <H2 n="13">Contact &amp; DPO</H2>
        <p>
          Privacy questions / data requests: <a href="mailto:privacy@nakalabs.xyz" className="text-[#4D6BFF] hover:underline">privacy@nakalabs.xyz</a><br />
          Data Protection Officer (once appointed): <a href="mailto:dpo@nakalabs.xyz" className="text-[#4D6BFF] hover:underline">dpo@nakalabs.xyz</a><br />
          Legal: <a href="mailto:legal@nakalabs.xyz" className="text-[#4D6BFF] hover:underline">legal@nakalabs.xyz</a>
        </p>

        <div className="mt-16 pt-8 border-t border-white/[0.06] text-xs text-gray-500">
          <p>&copy; 2026 Naka Labs. This Privacy Policy works together with our <Link href="/terms" className="text-[#4D6BFF] hover:underline">Terms of Service</Link>.</p>
        </div>
      </div>
    </div>
  );
}
