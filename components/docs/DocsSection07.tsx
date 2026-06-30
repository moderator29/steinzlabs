import { Repeat, Shield, Crosshair, Zap, AlertTriangle, ArrowRight, ArrowDown, LineChart, Clock, Filter, Volume2, Dna } from 'lucide-react';

const MM_STEPS = [
  { n: '1', title: 'Pick a token & strategy', desc: 'Choose the token, chain, and a strategy (Grid or Range). Set your spread, levels, order size, budget, max inventory and slippage.' },
  { n: '2', title: 'Reference price', desc: 'The bot tracks a live market reference (DexScreener) or a manual price you set, and builds buy rungs below it and sell rungs above it.' },
  { n: '3', title: 'Fund & activate', desc: 'Fund your non-custodial kernel account and flip the strategy to Active. Until then it stays paused and trades nothing.' },
  { n: '4', title: 'Work the spread', desc: 'Every cycle the engine places at most one capped swap through your session key — buying at/below a buy rung, selling at/above a sell rung — recording each fill and net PnL.' },
];

const MM_STRATEGIES = [
  { title: 'Grid', desc: 'A symmetric ladder of buy rungs below and sell rungs above the reference — accumulate on dips, distribute on rips, capturing the oscillation.' },
  { title: 'Range', desc: 'Accumulate at/below a lower bound and distribute at/above an upper bound you set — for tokens you expect to trade in a band.' },
];

const SWAP_CHAINS = [
  { name: 'Solana',    note: 'Best route across every major Solana DEX.' },
  { name: 'Ethereum',  note: 'Aggregated liquidity from the top EVM DEXes.' },
  { name: 'Base',      note: 'Low-fee routing across Base-native DEXes.' },
  { name: 'Arbitrum',  note: 'Sub-second finality, L2-priced swaps.' },
  { name: 'Polygon',   note: 'Mature DEX liquidity at Polygon gas.' },
  { name: 'BSC',       note: 'PancakeSwap and the full BSC DEX set.' },
];

const SNIPER_STEPS = [
  { n: '1', title: 'Discovery',   desc: 'Watches freshly-created liquidity pools and trending launches the moment they appear. The live Discover feed browses EVM chains (GeckoTerminal new-pools); armed auto-snipers run across all supported chains including Solana.' },
  { n: '2', title: 'Shadow Guardian scan', desc: 'Each candidate is run through a multi-layer GoPlus security gate: honeypot simulation, buy/sell tax, liquidity lock, ownership/mint authority, and holder concentration. Failing tokens are routed to a separate Blocked tab.' },
  { n: '3', title: 'You sign',    desc: 'When a launch matches your criteria the trade is prepared and you approve it with your own wallet (EIP-712). Non-custodial — keys and funds never leave your wallet.' },
  { n: '4', title: 'Auto-manage', desc: 'Open positions are tracked live and auto-sold at your take-profit, stop-loss, or trailing-stop threshold, with PnL recorded.' },
];

// Full sniper capability surface.
const SNIPER_FEATURES = [
  { title: 'Live new-token feed', desc: 'Fresh pools across Ethereum, Base, Arbitrum, Optimism, BSC, Polygon and Avalanche, with real logos, contract copy, and source chips.' },
  { title: 'Discover + Blocked tabs', desc: 'Clean launches in Discover; honeypots / high-tax / rug-risk tokens isolated in Blocked (Shadow Guardian) so you see why they failed.' },
  { title: 'Token detail drawer', desc: 'Per-token security audit, related wallets, similar tokens, socials, and one-click manual Buy/Sell routed through the 0x aggregator.' },
  { title: 'Criteria builder', desc: 'Arm snipers on new-token launch, whale-buy, or price-target triggers with min-liquidity, max-tax, slippage, and per-snipe spend.' },
  { title: 'Auto-sell engine', desc: 'Take-profit, stop-loss and trailing-stop exits monitored by cron and executed at base-unit precision.' },
  { title: 'Alerts', desc: 'Market-cap, price, migration and +% alerts with sound, delivered in real time.' },
  { title: 'Positions, PnL & history', desc: 'Open/realized positions, chain-aware USD PnL, full execution history and stats — plus a one-tap kill switch that pauses every sniper.' },
];

// Firehose / discovery-feed upgrades.
const FIREHOSE_FEATURES = [
  { icon: Filter, title: 'Launchpad source filter', desc: 'Filter the feed by where a token launched — Pump.fun, Let’s Bonk, Believe, Bags, Moonshot, Heaven, Jup Studio, Raydium and more on Solana; Uniswap, Aerodrome, PancakeSwap and Trader Joe on EVM — each with its real logo.' },
  { icon: Shield, title: 'Audit filters', desc: 'Tighten the feed to hide honeypots and show only tokens with real social presence, with a minimum security-score threshold available on armed criteria.' },
  { icon: Clock, title: 'OG mode', desc: 'Show only the earliest token Naka has seen per (chain, symbol) — an honest “first seen on Naka” filter (not a claim of first-ever).' },
  { icon: Volume2, title: 'Sound alerts', desc: 'Optional chimes for new tokens and bonding-curve graduations, with a volume control, so you hear a launch without watching the screen.' },
  { icon: Dna, title: 'Per-card DNA / contract analyzer', desc: 'Each card carries lazy-loaded Shadow Guardian audit badges and a DNA button that opens the token in the Contract Analyzer.' },
  { icon: Crosshair, title: 'Multi-chain detection', desc: 'New-token detection runs across Ethereum, Solana (Helius + Jito), BNB Chain, TON and Avalanche, each with its own mempool / priority-fee semantics.' },
];

// Background (account-abstraction) sniping caps.
const AA_BOUNDS = [
  { title: 'Per-trade USD cap', desc: 'A signed ceiling on the USD value of any single background buy.' },
  { title: 'Daily USD cap', desc: 'A signed ceiling on total background spend per day.' },
  { title: 'Trades per day', desc: 'A rate limit enforced on-chain — at most N background trades in any rolling 24 hours.' },
  { title: 'Expiry', desc: 'The grant carries an on-chain timestamp and stops working automatically when it lapses.' },
];

export function DocsSection07() {
  return (
    <section id="trading-suite" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">07</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Trading Suite</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        Everything you need to act on your research · swaps, limit orders, stop-loss, copy trading, and a sniper bot · all in one place, every trade security-checked before it hits the chain.
      </p>

      {/* Multi-Chain Swap */}
      <div id="swap-engine" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Repeat className="w-4 h-4 text-[#0066FF]" />Multi-Chain Swap
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Swap any token on any supported chain from one interface. The routing engine queries multiple sources in parallel and picks the best price · no wallet switching, no bridge juggling.
        </p>

        {/* How to swap · step-by-step */}
        <div className="nl-glass rounded-xl p-4 mb-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#4D6BFF] font-semibold mb-3">How a swap works</p>
          <ol className="space-y-2 text-xs text-gray-300">
            <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">1</span><span>Open <span className="text-white font-semibold">Dashboard → Swap</span> (or ask VTX <span className="font-mono text-[#4D6BFF]">&quot;swap 100 USDC to SOL&quot;</span>).</span></li>
            <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">2</span><span>Pick the chain, the <span className="text-white font-semibold">From</span> token, and the <span className="text-white font-semibold">To</span> token. Paste a contract for anything not in the picker.</span></li>
            <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">3</span><span>Set the amount and the slippage tolerance (default 1 %).</span></li>
            <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">4</span><span>Review the route summary, the security verdict, and the estimated output. Tap <span className="text-white font-semibold">Confirm</span>.</span></li>
            <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">5</span><span>Sign in your wallet. Transaction lands on-chain, receipt appears in your notifications.</span></li>
          </ol>
        </div>

        {/* Worked example */}
        <div className="bg-black/30 border border-white/[0.06] rounded-xl p-4 mb-4 font-mono text-xs">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Example</p>
          <div className="flex items-center gap-2"><ArrowRight className="w-3 h-3 text-gray-500" /><span className="text-white">From: 100 USDC on Solana</span></div>
          <div className="ms-4 text-gray-500">↓ best-of-3 aggregator</div>
          <div className="flex items-center gap-2"><ArrowDown className="w-3 h-3 text-gray-500" /><span className="text-white">To: ≈ 0.54 SOL</span></div>
          <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Slippage</span><span className="text-white">1.0 %</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Network fee</span><span className="text-white">~$0.01</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Pre-flight scan</span><span className="text-emerald-400">SAFE</span></div>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          {SWAP_CHAINS.map((c) => (
            <div key={c.name} className="flex items-start gap-3 p-3 nl-glass rounded-xl">
              <span className="text-xs font-bold text-[#4D6BFF] w-20 flex-shrink-0">{c.name}</span>
              <span className="text-xs text-gray-400">{c.note}</span>
            </div>
          ))}
        </div>
        <div className="bg-[#10B981]/[0.05] border border-[#10B981]/20 rounded-xl p-3">
          <p className="text-xs text-gray-400">
            <span className="text-[#10B981] font-semibold">Pre-flight safety:</span> every swap runs a Shadow Guardian simulation before it signs. Honeypot, impossible-to-sell, and high-tax contracts are blocked automatically.
          </p>
        </div>

        <div className="mt-3 bg-[#0066FF]/[0.05] border border-[#0066FF]/25 rounded-xl p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#4D6BFF] font-semibold">AI &amp; Swap Safety</p>
          <p className="text-xs text-gray-300 leading-relaxed">
            VTX Agent can quote swaps and render an inline Swap Card, but it <span className="text-white font-semibold">cannot execute trades, withdraw funds, or sign anything</span> on your behalf. Every swap is broadcast only after you manually tap <span className="font-mono text-[#4D6BFF]">Sign &amp; Swap</span> and your wallet approves the signature.
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            VTX sees only your public wallet address · the same one visible on any explorer. Private keys and seed phrases never leave your device and are never sent to the AI. High-price-impact swaps (&gt;30%) are blocked by the card as a safety rail. Quotes are refreshed at sign time, so execution price can shift slightly between preview and confirmation.
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            AI = assistant. Wallet = authority. Always review the From / To / amount / slippage line before signing.
          </p>
        </div>
      </div>

      {/* Limit orders / stop-loss */}
      <div className="mb-10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#F59E0B]" />Limit Orders &amp; Stop-Loss
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Set a price, walk away. Limit orders fire a buy or sell when the market hits your target. Stop-loss and take-profit keep open positions on autopilot · set the rule once, it executes without you at the keyboard.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="nl-glass rounded-xl p-3">
            <div className="text-xs font-semibold text-white mb-0.5">Limit buy / sell</div>
            <div className="text-xs text-gray-500">Executes at your target price or better, expires after the window you set.</div>
          </div>
          <div className="nl-glass rounded-xl p-3">
            <div className="text-xs font-semibold text-white mb-0.5">Stop-loss</div>
            <div className="text-xs text-gray-500">Auto-exits a position if it drops past a floor you define.</div>
          </div>
          <div className="nl-glass rounded-xl p-3">
            <div className="text-xs font-semibold text-white mb-0.5">Take-profit</div>
            <div className="text-xs text-gray-500">Auto-sells once you hit your target price so you lock the win in.</div>
          </div>
          <div className="nl-glass rounded-xl p-3">
            <div className="text-xs font-semibold text-white mb-0.5">Trailing stop</div>
            <div className="text-xs text-gray-500">Follows the price up and only exits on a pullback of the % you choose.</div>
          </div>
        </div>
      </div>

      {/* Copy Trading */}
      <div id="copy-trading" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#F59E0B]" />Copy Trading
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Mirror the buys of any tracked wallet. Set a max per-trade cap, a daily spend cap, and optional safety filters. Copies fire automatically when the source wallet trades · you keep control of the exits.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Max per trade', desc: 'Cap the USD value of any single copied buy.' },
            { label: 'Daily spend cap', desc: 'Hard ceiling across the day so a runaway source wallet can&apos;t drain you.' },
            { label: 'Trust Score filter', desc: 'Auto-skip buys on tokens below your safety threshold.' },
            { label: 'Pause anytime', desc: 'Disable a rule without closing the existing positions it opened.' },
          ].map((c) => (
            <div key={c.label} className="nl-glass rounded-xl p-3">
              <div className="text-xs font-semibold text-white mb-0.5">{c.label}</div>
              <div className="text-xs text-gray-500" dangerouslySetInnerHTML={{ __html: c.desc }} />
            </div>
          ))}
        </div>
      </div>

      {/* Sniper Bot */}
      <div id="sniper-bot" className="scroll-mt-20">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-[#EF4444]" />Sniper Bot
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          An <span className="text-white font-semibold">EVM-only, non-custodial</span> sniper: detect new launches the instant liquidity is added, gate every one through Shadow Guardian, and buy with your own wallet — nothing is bought blindly and we never hold your keys or funds.
        </p>
        <div className="space-y-2 mb-4">
          {SNIPER_STEPS.map((s) => (
            <div key={s.n} className="flex gap-3 p-3 nl-glass rounded-xl">
              <div className="w-6 h-6 rounded-full bg-[#EF4444]/15 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-[#EF4444]">{s.n}</span>
              </div>
              <div>
                <div className="text-xs font-semibold text-white">{s.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Non-custodial system */}
        <div className="nl-glass rounded-xl p-4 mb-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.22)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-[#0066FF]" />
            <span className="text-sm font-semibold text-white">Non-Custodial by Design</span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            The sniper authorizes trades with an <span className="text-white font-semibold">EIP-712 session key</span> signed by your own wallet — Naka Labs never takes custody of your keys or funds, and every buy is one you approve. Auto-execution runs across the major EVM chains (Ethereum, Base, Arbitrum, Optimism, BSC, Polygon, Avalanche) plus <span className="text-white font-semibold">Solana</span> (Helius + Jito) and TON. The browse-able Discover feed currently lists EVM new-pools; Solana and TON tokens flow through armed criteria and auto-execution.
          </p>
        </div>

        {/* Firehose upgrades */}
        <div id="sniper-firehose" className="scroll-mt-20 mb-4">
          <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
            <Crosshair className="w-3.5 h-3.5 text-[#EF4444]" />Firehose &amp; filters
          </h4>
          <div className="grid sm:grid-cols-2 gap-2">
            {FIREHOSE_FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="nl-glass rounded-xl p-3" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.12)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5 text-[#4D6BFF] flex-shrink-0" />
                  <div className="text-xs font-semibold text-white">{title}</div>
                </div>
                <div className="text-xs text-gray-500 leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Background (AA) sniping */}
        <div id="background-sniping" className="scroll-mt-20 mb-4">
          <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#0066FF]" />Background (AA) sniping
          </h4>
          <p className="text-xs text-gray-400 leading-relaxed mb-3">
            Background sniping lets the sniper execute buys <span className="text-white font-semibold">while your tab is closed</span> — without ever holding your main key. It uses account-abstraction (ZeroDev) smart-account session keys: your main wallet signs a one-time approval that authorizes a <span className="text-white font-semibold">separate, limited session key</span> to act on a smart account you fund with your snipe budget. Only that session key is held server-side (encrypted); your main key never leaves the browser.
          </p>
          <div className="grid sm:grid-cols-2 gap-2 mb-3">
            {AA_BOUNDS.map((b) => (
              <div key={b.title} className="nl-glass rounded-xl p-3">
                <div className="text-xs font-semibold text-white mb-0.5">{b.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{b.desc}</div>
              </div>
            ))}
          </div>
          <div className="nl-glass rounded-xl p-3 mb-2">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#4D6BFF] font-semibold mb-2">How to enable</p>
            <ol className="space-y-1.5 text-xs text-gray-300">
              <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">1</span><span>Open the <span className="text-white font-semibold">Background Sniping</span> card on the Sniper page.</span></li>
              <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">2</span><span>Pick the chain and set your caps: per-trade USD, daily USD, trades/day, and how many hours the grant stays valid.</span></li>
              <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">3</span><span>Sign the one-time approval with your wallet password and fund the smart account with your snipe budget.</span></li>
              <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">4</span><span>Background buys now run within those bounds until the grant expires — and you can revoke it at any time.</span></li>
            </ol>
          </div>
          <div className="flex items-start gap-2 p-3 nl-glass rounded-xl">
            <Shield className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400 leading-relaxed">
              Non-custodial: the only funds at risk are what you put in the smart account — never your main wallet. The grant is bounded on-chain (expiry + rate limit) and by your signed USD caps, and it is revocable. EVM only; requires the operator to have configured the AA backend.
            </p>
          </div>
        </div>

        {/* Full capability grid */}
        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          {SNIPER_FEATURES.map((f) => (
            <div key={f.title} className="nl-glass rounded-xl p-3" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.15)' }}>
              <div className="text-xs font-semibold text-white">{f.title}</div>
              <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 p-3 bg-[#F59E0B]/[0.05] border border-[#F59E0B]/20 rounded-xl">
          <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400">New-token trading carries extreme risk. Even with safety checks enabled, new tokens can fail. Never allocate more than you are prepared to lose entirely.</p>
        </div>
        <div className="flex items-start gap-2 p-3 nl-glass rounded-xl mt-2">
          <Shield className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400">The Sniper Bot is a <span className="text-white font-semibold">Max tier</span> feature. Free, Mini, and Pro tiers can preview the dashboard but cannot arm a sniper.</p>
        </div>
      </div>

      {/* Market Maker Bot */}
      <div id="market-maker" className="scroll-mt-20 mt-10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <LineChart className="w-4 h-4 text-[#0066FF]" />Market Maker Bot
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          An <span className="text-white font-semibold">EVM-only, non-custodial</span> automated market maker. It places two-sided swaps around a reference price to work a spread on a token you choose — buying dips, selling rips — entirely within caps you sign for. It is a trading tool, not a yield product.
        </p>

        {/* How it works */}
        <div className="space-y-2 mb-4">
          {MM_STEPS.map((s) => (
            <div key={s.n} className="flex gap-3 p-3 nl-glass rounded-xl">
              <div className="w-6 h-6 rounded-full bg-[#0066FF]/15 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-[#4D6BFF]">{s.n}</span>
              </div>
              <div>
                <div className="text-xs font-semibold text-white">{s.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Strategies */}
        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          {MM_STRATEGIES.map((f) => (
            <div key={f.title} className="nl-glass rounded-xl p-3" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.15)' }}>
              <div className="text-xs font-semibold text-white">{f.title}</div>
              <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Non-custodial + caps */}
        <div className="nl-glass rounded-xl p-4 mb-4" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.22)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-[#0066FF]" />
            <span className="text-sm font-semibold text-white">Non-Custodial &amp; Bounded</span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            The bot trades through the same <span className="text-white font-semibold">EIP-712 session key</span> you sign for the sniper — Naka Labs never holds your keys or funds, and execution is bounded on every side: a per-strategy <span className="text-white font-semibold">budget</span> (a true lifetime spend ceiling), a <span className="text-white font-semibold">max inventory</span> cap, a server-side <span className="text-white font-semibold">slippage</span> clamp, and your signed <span className="text-white font-semibold">per-trade + daily USD caps</span> (shared across the sniper and market maker). New strategies are created <span className="text-white font-semibold">paused</span> — nothing trades until you fund the kernel and activate, and Pause/Stop halts it before the next fill.
        </p>
        </div>

        <div className="flex items-start gap-2 p-3 bg-[#F59E0B]/[0.05] border border-[#F59E0B]/20 rounded-xl">
          <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400">Market making can lose money — impermanent loss, adverse selection, and gas all eat into a spread. PnL shown is net of cost basis, and there are no guaranteed returns. Start small. (CLMM/LP-range and volume strategies are intentionally not offered.)</p>
        </div>
      </div>
    </section>
  );
}
