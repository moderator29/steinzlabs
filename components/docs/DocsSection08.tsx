import { TrendingUp, Star, Bell } from 'lucide-react';

const SMART_MONEY_CRITERIA = [
  'Minimum 6-month on-chain trading history',
  'Verified positive PnL across at least 50 closed trades',
  'Win rate ≥ 60% on positions held < 7 days',
  'No identified bot activity or wash trading',
  'Active on at least 2 supported chains',
];

const TRACKING_FEATURES = [
  { icon: TrendingUp, title: 'Live Entry Alerts', desc: 'Get notified the moment a tracked smart money wallet buys a new token — before price impact.' },
  { icon: Star, title: 'Copy Trading Panel', desc: 'One-click position mirroring with configurable size multiplier and auto-slippage.' },
  { icon: Bell, title: 'Exit Warnings', desc: 'Alert when a smart money wallet begins selling a position you hold — exit before the dump.' },
];

const FEED_COLUMNS = ['Wallet', 'Token', 'Chain', 'Action', 'Size USD', 'Time', 'PnL Signal'];

export function DocsSection08() {
  return (
    <section id="smart-money" className="mb-14 scroll-mt-24">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-4xl font-bold text-[#0A1EFF]/15 font-mono select-none">08</span>
        <h2 className="text-2xl font-bold text-white">Smart Money Tracking</h2>
      </div>
      <p className="text-gray-400 text-sm leading-relaxed mb-6 ml-12">
        Follow a curated list of 500+ verified profitable wallets in real-time. Smart Money tracking is the core intelligence layer of the Context Feed.
      </p>

      <div className="ml-12 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Wallet Qualification Criteria</h3>
          <p className="text-xs text-gray-400 mb-3">Wallets are added to the Smart Money list only when they meet all of the following criteria:</p>
          <ul className="space-y-2">
            {SMART_MONEY_CRITERIA.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                <div className="w-4 h-4 bg-[#0A1EFF]/10 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-[#0A1EFF]">{i + 1}</span>
                </div>
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Tracking Features</h3>
          <div className="space-y-3">
            {TRACKING_FEATURES.map(f => (
              <div key={f.title} className="flex gap-3 bg-[#141824] border border-[#1E2433] rounded-xl p-4">
                <div className="w-8 h-8 bg-[#0A1EFF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-4 h-4 text-[#0A1EFF]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white mb-0.5">{f.title}</div>
                  <div className="text-xs text-gray-400 leading-relaxed">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Smart Money Feed Columns</h3>
          <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <tbody>
                {FEED_COLUMNS.map((col, i) => (
                  <tr key={col} className="border-b border-[#1E2433] last:border-0">
                    <td className="px-3 py-2 text-gray-500 w-8">{i + 1}</td>
                    <td className="px-3 py-2 text-white font-medium">{col}</td>
                    <td className="px-3 py-2 text-gray-400">
                      {col === 'Wallet' && 'Address (truncated) with entity label if known'}
                      {col === 'Token' && 'Symbol + contract address link'}
                      {col === 'Chain' && 'Network identifier'}
                      {col === 'Action' && 'BUY / SELL / SWAP'}
                      {col === 'Size USD' && 'USD value at time of transaction'}
                      {col === 'Time' && 'Time ago (e.g., "3m ago")'}
                      {col === 'PnL Signal' && 'Estimated unrealized gain from entry price'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
