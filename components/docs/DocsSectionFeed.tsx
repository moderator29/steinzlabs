import { Rss, Gift, Newspaper, LineChart, Sparkles, Bell, ArrowRight, Shield } from 'lucide-react';

// Feed compose flow, kept truthful to the product: text, one image under 1MB,
// up to three topic tags, posted from the floating compose button.
const FEED_STEPS = [
  { n: '1', title: 'Open the Feed', desc: 'On the dashboard, select the Feed tab to load the stream. Switch between Signal for trending posts and Pack for the people you follow.' },
  { n: '2', title: 'Filter by topic', desc: 'Tap a single catalogue topic along the top to narrow the stream to that subject, and clear it to return to the full feed.' },
  { n: '3', title: 'Compose', desc: 'Tap the floating plus button at the bottom right to open the composer. Write your text, attach one image under 1MB if you want, and add up to three topic tags.' },
  { n: '4', title: 'Engage', desc: 'On any post use Like, Comment, or Repost, and open a thread to reply. Tap Gift to send the author real crypto from your own wallet.' },
];

const GIFT_CHAINS = [
  { name: 'Ethereum', note: 'Sends native ETH straight from your wallet.' },
  { name: 'Base', note: 'Sends native ETH on Base.' },
  { name: 'BNB Chain', note: 'Sends native ETH on BNB Chain.' },
  { name: 'Robinhood Chain', note: 'Sends native ETH on chain id 4663.' },
  { name: 'Solana', note: 'Sends native SOL.' },
];

const NEWS_POINTS = [
  { title: 'Sentiment tags', desc: 'Every headline is read for tone and tagged bullish or bearish, so you can judge a story before you open it.' },
  { title: 'Market mood banner', desc: 'A banner above the headlines shows the live Fear and Greed reading for the overall temperature of the market.' },
  { title: 'Twice-daily digest', desc: 'The bell Alerts toggle opts you into a crypto news digest delivered twice a day to your enabled channels.' },
  { title: 'Your channels', desc: 'The digest is sent to Telegram, email, or both. Inbox delivery needs the email channel enabled on your account first.' },
];

export function DocsSectionFeed() {
  return (
    <section id="social-markets" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">11</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Feed, Gifting &amp; Markets</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        The social and markets layer of the dashboard · post and follow in the Feed, reward good calls with real crypto, read sentiment-tagged news, and track real-world markets beside your crypto.
      </p>

      {/* The Feed */}
      <div id="feed-social" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Rss className="w-4 h-4 text-[#0066FF]" />The Feed
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          A social feed built into the dashboard. Each post is short text with one optional image and up to three topic tags. Two views let you flip between discovery and your own circle: <span className="text-white font-semibold">Signal</span> surfaces trending posts, and <span className="text-white font-semibold">Pack</span> shows only the people you follow.
        </p>
        <div className="space-y-2 mb-4">
          {FEED_STEPS.map((s) => (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: 'Signal', desc: 'The posts gaining the most traction right now, for finding new voices.' },
            { label: 'Pack', desc: 'Only the accounts you follow, so your circle stays easy to check.' },
            { label: 'Topic filters', desc: 'A single-select catalogue filter narrows the stream to one subject.' },
            { label: 'Post actions', desc: 'Like, Comment, Repost, and Gift sit on every post in the feed.' },
          ].map((c) => (
            <div key={c.label} className="nl-glass rounded-xl p-3">
              <div className="text-xs font-semibold text-white mb-0.5">{c.label}</div>
              <div className="text-xs text-gray-500">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Gifting */}
      <div id="crypto-gifting" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Gift className="w-4 h-4 text-[#10B981]" />Gifting
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Send real crypto to another person straight from your wallet, from a post in the Feed or from their profile. Gifting is <span className="text-white font-semibold">non-custodial</span>: funds move directly from your own wallet to the recipient&apos;s resolved receive address, and the platform never holds them.
        </p>
        <div className="nl-glass rounded-xl p-4 mb-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#4D6BFF] font-semibold mb-3">How a gift works</p>
          <ol className="space-y-2 text-xs text-gray-300">
            <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">1</span><span>Tap <span className="text-white font-semibold">Gift</span> on someone&apos;s post or profile to open the gift sheet with them set as the recipient.</span></li>
            <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">2</span><span>Choose the network, then enter the amount. The app resolves the recipient&apos;s receive address for that chain.</span></li>
            <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">3</span><span>Review the recipient and address, then confirm and sign the transfer in your connected wallet.</span></li>
            <li className="flex gap-2.5"><span className="w-4 h-4 rounded-full bg-white/[0.06] text-[10px] text-gray-400 flex items-center justify-center font-semibold shrink-0">4</span><span>Watch the confirmation. The gift moves on-chain like any other transaction.</span></li>
          </ol>
        </div>
        <div className="space-y-2 mb-4">
          {GIFT_CHAINS.map((c) => (
            <div key={c.name} className="flex items-start gap-3 p-3 nl-glass rounded-xl">
              <span className="text-xs font-bold text-[#4D6BFF] w-32 flex-shrink-0">{c.name}</span>
              <span className="text-xs text-gray-400">{c.note}</span>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 p-3 bg-[#10B981]/[0.05] border border-[#10B981]/20 rounded-xl">
          <Shield className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400">Non-custodial by design: your funds go wallet to wallet and you sign every transfer yourself. The platform never takes custody of a gift.</p>
        </div>
      </div>

      {/* News & Alerts */}
      <div id="news-alerts" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-[#F59E0B]" />News &amp; Alerts
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          The News tab tags each headline for sentiment and reads the overall mood of the market, then lets you opt into a digest so the news comes to you.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {NEWS_POINTS.map((c) => (
            <div key={c.title} className="nl-glass rounded-xl p-3">
              <div className="text-xs font-semibold text-white mb-0.5">{c.title}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{c.desc}</div>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 p-3 nl-glass rounded-xl">
          <Bell className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400">Tap the bell Alerts toggle to turn the twice-daily digest on or off. To receive it by email, enable the email channel in your notification settings first.</p>
        </div>
      </div>

      {/* Markets & RWA */}
      <div id="markets-board" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <LineChart className="w-4 h-4 text-[#0066FF]" />Markets &amp; Real-World Assets
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          The Markets tab pairs your crypto view with a real-world-asset board. Equities and commodities are quoted in the familiar iOS Stocks style, laid out beneath the crypto markets so you can scan both in one scroll.
        </p>
        <div className="bg-black/30 border border-white/[0.06] rounded-xl p-4 mb-4 font-mono text-xs">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">On the Markets tab</p>
          <div className="flex items-center gap-2"><ArrowRight className="w-3 h-3 text-gray-500" /><span className="text-white">Top gainers and coins heating up</span></div>
          <div className="flex items-center gap-2 mt-1"><ArrowRight className="w-3 h-3 text-gray-500" /><span className="text-white">Full crypto market overview</span></div>
          <div className="flex items-center gap-2 mt-1"><ArrowRight className="w-3 h-3 text-gray-500" /><span className="text-white">Real-world-asset board: equities and commodities quotes</span></div>
        </div>
        <div className="flex items-start gap-2 p-3 nl-glass rounded-xl">
          <LineChart className="w-3.5 h-3.5 text-[#4D6BFF] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400">Seeing traditional markets beside your tokens gives you the broader risk mood at a glance, without switching to a separate app.</p>
        </div>
      </div>

      {/* Robinhood Chain */}
      <div id="robinhood-chain" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#10B981]" />Robinhood Chain
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Robinhood Chain is a supported EVM network (chain id 4663) with native ETH. You can <span className="text-white font-semibold">hold, send, and gift</span> ETH on it today, non-custodially, using the same wallet and flows as any other chain.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="nl-glass rounded-xl p-3">
            <div className="text-xs font-semibold text-white mb-0.5">Available now</div>
            <div className="text-xs text-gray-500">Hold native ETH, and send or gift it straight from your own wallet.</div>
          </div>
          <div className="nl-glass rounded-xl p-3">
            <div className="text-xs font-semibold text-white mb-0.5">Coming soon</div>
            <div className="text-xs text-gray-500">In-app DEX swap routing, which switches on as aggregators list the network.</div>
          </div>
        </div>
      </div>

      {/* Prediction */}
      <div id="prediction-markets" className="scroll-mt-20">
        <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#0066FF]" />Prediction
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          A Prediction tab on the dashboard previews the prediction markets coming to the platform, where people take positions on the outcome of real events. For now it is a visual preview that marks where the live markets will appear.
        </p>
        <div className="flex items-start gap-2 p-3 nl-glass rounded-xl">
          <Sparkles className="w-3.5 h-3.5 text-[#4D6BFF] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400">Open the Prediction tab to see the layout ahead of launch, so you know exactly where to look when the markets go live.</p>
        </div>
      </div>
    </section>
  );
}
