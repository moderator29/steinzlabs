import { Filter, Bell, Zap, ArrowUpRight } from 'lucide-react';

const SIGNAL_TYPES = [
  { type: 'whale_buy', color: 'text-green-400', bg: 'bg-green-400/10', label: 'Whale Buy', desc: 'Wallets with >$100k portfolio buying a new position' },
  { type: 'smart_money', color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Smart Money Entry', desc: 'Tracked profitable wallets entering a token' },
  { type: 'new_launch', color: 'text-purple-400', bg: 'bg-purple-400/10', label: 'New Launch', desc: 'Token launched within the past 24 hours with early volume' },
  { type: 'unusual_volume', color: 'text-yellow-400', bg: 'bg-yellow-400/10', label: 'Unusual Volume', desc: '5x or greater volume spike vs 7-day average' },
  { type: 'cluster_move', color: 'text-orange-400', bg: 'bg-orange-400/10', label: 'Cluster Move', desc: 'Coordinated buying by a detected wallet cluster' },
  { type: 'social_spike', color: 'text-pink-400', bg: 'bg-pink-400/10', label: 'Social Spike', desc: 'Sudden increase in mentions across tracked channels' },
];

const FILTER_OPTIONS = [
  { label: 'Chain', values: ['All', 'ETH', 'BASE', 'SOL', 'ARB', 'BSC'] },
  { label: 'Min Value', values: ['$1K', '$10K', '$50K', '$100K', '$500K'] },
  { label: 'Signal Type', values: ['All types', 'Whale only', 'Smart Money', 'New launches'] },
  { label: 'Time Range', values: ['1m', '5m', '15m', '1h', '6h', '24h'] },
];

export function DocsSection03() {
  return (
    <section id="context-feed" className="mb-14 scroll-mt-24">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl font-bold text-[#0A1EFF]/15 font-mono select-none">03</span>
        <h2 className="text-2xl font-bold text-white">Context Feed</h2>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed mb-6 ml-12">
        The Context Feed is a real-time stream of on-chain intelligence events, updated every 5 seconds from live blockchain data.
      </p>

      <div className="ml-12 space-y-6">
        <div id="context-feed-signals">
          <h3 className="text-sm font-semibold text-white mb-3">Signal Types</h3>
          <div className="space-y-2">
            {SIGNAL_TYPES.map(s => (
              <div key={s.type} className="flex items-start gap-3 bg-[#141824] border border-[#1E2433] rounded-xl p-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${s.color} ${s.bg} flex-shrink-0`}>
                  {s.type}
                </span>
                <div>
                  <div className="text-xs font-semibold text-white mb-0.5">{s.label}</div>
                  <div className="text-xs text-gray-400">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div id="context-feed-filters">
          <h3 className="text-sm font-semibold text-white mb-3">Filters &amp; Sorting</h3>
          <p className="text-xs text-gray-400 mb-3 leading-relaxed">
            The feed supports multiple simultaneous filters. Active filters persist across page reloads via localStorage.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {FILTER_OPTIONS.map(f => (
              <div key={f.label} className="bg-[#141824] border border-[#1E2433] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="w-3.5 h-3.5 text-[#0A1EFF]" />
                  <span className="text-xs font-semibold text-white">{f.label}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {f.values.map(v => (
                    <span key={v} className="px-1.5 py-0.5 bg-[#0A0E1A] border border-[#2E3443] rounded text-[10px] text-gray-400">{v}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-[#0A1EFF]" />
            <span className="text-sm font-semibold text-white">Feed Alerts</span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Click the bell icon on any feed item to create an alert for that token or wallet. Alerts are delivered via in-app notifications, email, and optionally Telegram webhook.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            {[['5s', 'Feed refresh rate'], ['500+', 'Signals per hour'], ['Real-time', 'Block confirmation']].map(([val, label]) => (
              <div key={label} className="bg-[#0A0E1A] rounded-lg p-2">
                <div className="text-white font-bold">{val}</div>
                <div className="text-gray-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
