import { Shield, Target, Users, Lock, Sparkles } from 'lucide-react';

// Section 13 — About Naka Labs + Help Center
// Public user-facing "About" and support pointers. The old wallet-settings
// About + Help sections now route here so there is one source of truth.

export function DocsSection13() {
  return (
    <section id="about" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">13</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">About &amp; Support</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        Who we are, what we&apos;re building, and where to find help when you need it.
      </p>

      {/* Mission */}
      <div id="about-mission" className="scroll-mt-20 mb-8">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-[#4D6BFF]" /> Our mission
        </h3>
        <p className="text-sm text-gray-300 leading-relaxed mb-3">
          Naka Labs makes on-chain intelligence that used to belong to hedge-fund trading desks available to any individual crypto user — in their browser, without code, without a Bloomberg terminal, without twelve tabs of half-broken explorers.
        </p>
        <p className="text-sm text-gray-300 leading-relaxed">
          Everything on the platform is built around one idea: you deserve to see what smart money is doing, be warned before you trade into a scam, and be able to act in one click. No data hoarding, no pay-to-see-prices, no middleman between you and the chain.
        </p>
      </div>

      {/* What makes us different */}
      <div id="about-what-we-do" className="scroll-mt-20 mb-8">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#F59E0B]" /> What Naka Labs does
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title: 'Intelligence', desc: 'Context Feed, VTX Agent, DNA Analyzer, Wallet Clusters, Trending Detection.' },
            { title: 'Security', desc: 'Token Trust Score, Shadow Guardian pre-flight scan, Contract Analyzer, Domain Shield, Approval Manager.' },
            { title: 'Execution', desc: 'Multi-chain Swap, Copy Trading, Sniper Bot, Limit Orders, Stop-Loss, Take-Profit.' },
            { title: 'Analytics', desc: 'Portfolio tracker, Whale Tracker, Smart Money leaderboards, Bubble Map.' },
          ].map((b) => (
            <div key={b.title} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <div className="text-sm font-semibold text-white mb-1">{b.title}</div>
              <div className="text-xs text-gray-400 leading-relaxed">{b.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Wallet — non-custodial */}
      <div id="about-wallet" className="scroll-mt-20 mb-8">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#10B981]" /> Naka Wallet — non-custodial by design
        </h3>
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <ul className="space-y-2 text-xs text-gray-400 leading-relaxed">
            <li>— Your private key is stored on your device, encrypted with your password using AES-256-GCM.</li>
            <li>— Naka Labs never sees your key. No keyserver, no custody, no recovery by us.</li>
            <li>— If you lose access to your device, the <span className="text-white font-semibold">only</span> way to restore is the 12-word seed phrase you were shown at creation. Back it up before funding.</li>
            <li>— Supported chains: Ethereum, Solana, Base, Arbitrum, Optimism, Polygon, BSC, Avalanche, and more. See Preferences for the full list.</li>
            <li>— Encryption is the industry-standard AES-256-GCM with PBKDF2 (100,000 rounds). Nothing we run is custom crypto.</li>
          </ul>
        </div>
      </div>

      {/* Help Center */}
      <div id="about-help" className="scroll-mt-20 mb-8">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#0A1EFF]" /> Help Center &amp; support
        </h3>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          Most questions have an answer somewhere in these docs — use the sidebar to jump to a feature. For anything else:
        </p>
        <div className="space-y-2 text-xs text-gray-400">
          <div className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
            <Sparkles className="w-3.5 h-3.5 text-[#4D6BFF] mt-0.5 shrink-0" />
            <div>
              <div className="text-white font-semibold">Ask VTX</div>
              <div>Open the VTX Agent and ask &quot;how does the sniper bot work&quot; or &quot;why is my swap showing 2% slippage&quot;. It answers with live context.</div>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
            <Users className="w-3.5 h-3.5 text-[#0A1EFF] mt-0.5 shrink-0" />
            <div>
              <div className="text-white font-semibold">AI Customer Service</div>
              <div>In Profile → AI Customer Service you get a dedicated account-support chat that can see your plan, wallets, and recent activity so it can unstick you faster.</div>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#229ED9] mt-0.5 shrink-0"><path d="M21.6 4.1L2.6 11.3c-1 .3-1 1.7 0 2l4.9 1.8 1.9 6.1c.2.7 1.1.9 1.6.4l2.7-2.4 5 3.7c.6.4 1.4.1 1.6-.6L23 5.8c.2-.9-.7-1.7-1.4-1.7z" fill="currentColor" /></svg>
            <div>
              <div className="text-white font-semibold">Telegram bot</div>
              <div>@Nakalabsbot supports <span className="font-mono text-[#4D6BFF]">/help</span> and <span className="font-mono text-[#4D6BFF]">/status</span> — quick answers without leaving chat.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Safety disclaimer */}
      <div className="bg-[#F59E0B]/[0.05] border border-[#F59E0B]/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-[#F59E0B]" />
          <span className="text-sm font-semibold text-white">Safety first</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Every signal, Trust Score, and security scan on the platform is advisory. They raise the quality of your decisions dramatically — they do not guarantee profits or eliminate risk. Only trade with capital you can afford to lose, especially on new-listing tokens, meme coins, and any wallet that has not been independently vetted.
        </p>
      </div>
    </section>
  );
}
