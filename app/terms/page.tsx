import Link from 'next/link';
import { FileText } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

export const metadata = {
  title: 'Terms of Service · Naka Labs',
  description: 'The terms that govern your use of the Naka Labs platform.',
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

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#080C18] text-white">
      <div className="sticky top-0 z-40 bg-[#080C18]/98 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <BackButton href="/" label="Back" />
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="w-4 h-4 text-[#0A1EFF]" />
            Terms of Service
          </div>
          <Link href="/privacy" className="text-xs text-gray-400 hover:text-white">Privacy</Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 text-[15px] leading-[1.75] text-gray-300">
        <div className="mb-12 pb-8 border-b border-white/[0.06]">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">Terms of Service</h1>
          <p className="text-gray-500 text-sm">Last updated: April 2026 · Version 1.0</p>
          <p className="text-gray-400 mt-4">
            These Terms govern your access to and use of the Naka Labs platform (<strong>&quot;Naka Labs&quot;</strong>, <strong>&quot;we&quot;</strong>, <strong>&quot;our&quot;</strong>). By creating an account or using the platform you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree, do not use the platform.
          </p>
        </div>

        <H2 n="01">Eligibility</H2>
        <p>You must be at least 18 years old (or the age of majority in your jurisdiction) and legally permitted to use financial analytics and trading tools under the laws of your country. You may not use the platform if you are a resident of, or accessing from, a jurisdiction where such services are prohibited by law.</p>
        <p>You may not use the platform if you are subject to sanctions administered by the U.S. OFAC, EU Council, UK HMT, or UN Security Council, or appear on any applicable sanctions list.</p>

        <H2 n="02">What Naka Labs Is · and Isn&apos;t</H2>
        <p>Naka Labs is an information and analytics platform providing on-chain intelligence, market data, security scanning, and access to non-custodial trading tooling. <strong>Naka Labs is not a broker-dealer, investment adviser, money transmitter, or custodian.</strong></p>
        <p>Nothing on the platform · including AI-generated responses, Trust Scores, whale-tracking data, or copy-trading suggestions · constitutes financial, legal, tax, or investment advice. All information is provided for educational and informational purposes only.</p>

        <H2 n="03">Accounts &amp; Security</H2>
        <H3>Account creation</H3>
        <p>You are responsible for maintaining the confidentiality of your login credentials, seed phrases, wallet passwords, and private keys. Naka Labs cannot recover any of these. If you lose them, you will permanently lose access to the associated funds.</p>
        <H3>Prohibited conduct</H3>
        <p>You agree not to: (a) circumvent or attempt to circumvent security or access controls; (b) use the platform to launder funds, evade sanctions, or commit fraud; (c) scrape, crawl, or copy platform content at scale without written permission; (d) reverse-engineer the platform except where expressly permitted by law; (e) use the platform to harass, harm, or defraud other users.</p>

        <H2 n="04">Non-Custodial Wallets</H2>
        <p>The Naka Wallet is non-custodial. You generate and retain sole control of your private keys. Private keys are encrypted locally on your device using AES-256-GCM with a key derived from your password via PBKDF2 (100,000 iterations of SHA-256) and stored as opaque ciphertext on our servers. We cannot decrypt, recover, or access your keys.</p>
        <p>You are fully responsible for safeguarding your seed phrase, wallet password, and any derivative credentials. Lost credentials cannot be recovered by Naka Labs under any circumstances.</p>

        <H2 n="05">Trading, Swaps &amp; Fees</H2>
        <p>Trades executed through the platform are routed through third-party decentralized exchange aggregators (including but not limited to 0x Protocol and Jupiter). Naka Labs does not hold custody of assets at any point. Executions are subject to on-chain conditions including slippage, gas fees, and block-level reorg risk.</p>
        <p>Naka Labs charges a platform fee on swaps, disclosed upfront in each quote and included in the displayed estimated receive amount. Subscription tier fees are published on the <Link href="/pricing" className="text-[#4D6BFF] hover:underline">pricing page</Link> and charged via crypto payment rails.</p>

        <H2 n="5A">AI &amp; Swap Safety</H2>
        <p>VTX Agent is an intelligence layer, not a signer. When you ask VTX to swap, convert, or trade, the agent renders a Swap Card showing the proposed input token, output token, estimated receive amount, slippage tolerance, price impact, and platform fee. <strong>No transaction is broadcast, signed, or executed until you manually tap the "Sign &amp; Swap" (or "Execute Swap") button and your wallet approves the signature.</strong></p>
        <p>VTX does not and cannot: withdraw funds, transfer tokens, approve allowances, move assets between wallets, or execute any on-chain action on your behalf without your explicit per-transaction confirmation. AI-generated text is advisory only. The wallet is the sole authority — every state-changing action requires a fresh user signature prompted by the wallet itself.</p>
        <p>Your private keys and seed phrases are never transmitted to VTX, to Anthropic, or to any AI provider. VTX sees only your public wallet address (the same identifier visible on any block explorer) so it can quote swaps and read balances. Quotes are fetched fresh at signing time — the amount shown on the card may shift slightly due to market movement between quote and confirmation.</p>
        <p>High-price-impact swaps (greater than 30%) are automatically blocked by the Swap Card as a safety rail. You remain responsible for reviewing every swap detail before signing; Naka Labs is not liable for losses arising from signed transactions, including losses from slippage, MEV, incorrect token selection, or wallet compromise.</p>

        <H2 n="06">Risk Disclosure</H2>
        <p>Cryptocurrency trading involves substantial risk, including risk of total loss. You should only engage in crypto trading with funds you can afford to lose. Market volatility, smart contract exploits, protocol failures, exchange hacks, and network outages can all result in partial or total loss of funds.</p>
        <p>Security tools provided by Naka Labs · Trust Scores, Shadow Guardian, Contract Analyzer, Domain Shield, and others · reduce but do not eliminate risk. A token flagged as safe today may not be safe tomorrow. Always conduct your own due diligence.</p>
        <p>Past performance of any wallet, strategy, or platform tool is not indicative of future results.</p>

        <H2 n="07">Third-Party Services</H2>
        <p>The platform integrates third-party data providers and infrastructure: CoinGecko, Alchemy, Helius, Birdeye, DexScreener, GoPlus, LunarCrush, Anthropic Claude, Supabase, Vercel, Cloudflare, Sentry, PostHog, and others. Your use of the platform is additionally subject to the terms of these providers where applicable. Naka Labs is not responsible for outages, errors, or data inaccuracies originating with third-party providers.</p>

        <H2 n="08">Intellectual Property</H2>
        <p>All content, code, design, copy, and branding on the platform · except user-generated content and third-party content · is the property of Naka Labs and protected by applicable copyright and trademark law. You may not reproduce, distribute, or create derivative works without written permission.</p>
        <p>User-generated content (e.g., research posts, comments, VTX chat history) remains your property; by posting or creating you grant Naka Labs a non-exclusive, worldwide, royalty-free license to host, display, and distribute it as required to operate the platform.</p>

        <H2 n="09">Termination</H2>
        <p>You may terminate your account at any time from Settings → Account. Naka Labs may suspend or terminate your access if you violate these Terms, engage in fraudulent or illegal activity, or if required by law. Termination does not relieve either party of obligations incurred prior to termination.</p>
        <p>Upon termination, we will delete your account data within 30 days, subject to legal retention requirements. Your on-chain wallet remains yours · we have no control over it.</p>

        <H2 n="10">Disclaimers &amp; Limitation of Liability</H2>
        <p>THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTY OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW, NAKA LABS DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, NAKA LABS, ITS AFFILIATES, AND THEIR RESPECTIVE OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE PLATFORM.</p>
        <p>NAKA LABS&apos;S TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO NAKA LABS IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) USD $100.</p>

        <H2 n="11">Indemnification</H2>
        <p>You agree to indemnify and hold harmless Naka Labs from any claim, damage, loss, or expense (including reasonable legal fees) arising out of your use of the platform, your violation of these Terms, or your violation of any rights of a third party.</p>

        <H2 n="12">Dispute Resolution &amp; Governing Law</H2>
        <p>These Terms are governed by the laws of the jurisdiction in which Naka Labs is formally registered, without regard to its conflict of law provisions. Company registration is currently in process; once finalised, jurisdiction will be published on this page.</p>
        <p>Any dispute arising out of or relating to these Terms or the platform shall first be addressed through good-faith negotiation. If negotiation fails, disputes shall be resolved through binding arbitration, except where prohibited by law. You waive any right to a jury trial or to participate in a class action.</p>

        <H2 n="13">Changes to These Terms</H2>
        <p>We may revise these Terms from time to time. Material changes will be announced in the platform and take effect 30 days after announcement. Continued use of the platform after changes constitutes acceptance of the revised Terms.</p>

        <H2 n="14">Contact</H2>
        <p>
          Questions about these Terms: <a href="mailto:legal@nakalabs.xyz" className="text-[#4D6BFF] hover:underline">legal@nakalabs.xyz</a><br />
          General support: <a href="mailto:hello@nakalabs.xyz" className="text-[#4D6BFF] hover:underline">hello@nakalabs.xyz</a><br />
          Security disclosures: <a href="mailto:security@nakalabs.xyz" className="text-[#4D6BFF] hover:underline">security@nakalabs.xyz</a>
        </p>

        <div className="mt-16 pt-8 border-t border-white/[0.06] text-xs text-gray-500">
          <p>&copy; 2026 Naka Labs. These Terms work together with our <Link href="/privacy" className="text-[#4D6BFF] hover:underline">Privacy Policy</Link> and the disclaimers in our <Link href="/whitepaper" className="text-[#4D6BFF] hover:underline">Whitepaper</Link>.</p>
        </div>
      </div>
    </div>
  );
}
