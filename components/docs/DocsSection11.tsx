import { Send, Link2, Command, Lock, Bell, Zap } from 'lucide-react';

const CONNECT_STEPS = [
  { n: '1', title: 'Open Profile → Telegram', desc: 'Sign in to Naka Labs, tap your Profile, then open the Telegram row. (The same card lives in Settings → Notifications if you prefer the Settings area.)' },
  { n: '2', title: 'Generate a 6-digit code', desc: 'Tap "Generate Connect Code". A 6-digit one-time code appears, valid for 10 minutes.' },
  { n: '3', title: 'Open the bot', desc: 'Tap "Open Bot" · Telegram opens directly with @Nakalabsbot. Or search "@Nakalabsbot" inside Telegram yourself.' },
  { n: '4', title: 'Send /link <code>', desc: 'Inside the bot, send /link 123456 (replace with your code). The bot replies "Account linked" instantly and the Profile page flips to "Connected".' },
];

const FREE_COMMANDS = [
  { cmd: '/start', desc: 'Onboarding & quick links' },
  { cmd: '/help', desc: 'Full command list with your tier' },
  { cmd: '/status', desc: 'Show link status & current plan' },
  { cmd: '/link <code>', desc: 'Pair this Telegram chat to your account' },
  { cmd: '/unlink', desc: 'Disconnect this chat' },
  { cmd: '/price <symbol>', desc: 'Token price card with deep-link' },
  { cmd: '/watchlist', desc: 'Open your watchlist' },
  { cmd: '/alerts', desc: 'Recent triggered alerts (24h)' },
  { cmd: '/vtx <question>', desc: 'Open VTX AI (quota-gated, 25/day on Free)' },
];

const MINI_COMMANDS = [
  { cmd: '/whale <address>', desc: 'Wallet snapshot · gated because Whale Tracker is Mini+' },
  { cmd: '/portfolio', desc: 'Multi-chain wallet PnL · full Wallet Intelligence is Mini+' },
];

const PRO_COMMANDS = [
  { cmd: '/copy <whale>', desc: 'Toggle copy-trade for a whale · Copy Trading is a Pro feature' },
];

const MAX_COMMANDS = [
  { cmd: '/snipe <token>', desc: 'Configure the Sniper Bot · Max-only feature' },
];

const OUTBOUND_NOTIFS = [
  { type: 'Whale movements', desc: 'Buys/sells above your USD threshold from any tracked whale' },
  { type: 'Price alerts', desc: 'Custom price targets · quota differs by tier (3 / 10 / 50 / unlimited)' },
  { type: 'Copy-trade fills', desc: 'When a copy-trade you set up executes (Pro+)' },
  { type: 'Limit / stop orders', desc: 'Confirmation when your conditional order fills' },
  { type: 'Daily digest', desc: 'A 9am UTC summary if enabled in Settings' },
  { type: 'Quiet-hours digest', desc: 'Batched alerts if you set quiet hours, delivered every 4h' },
];

const TIER_BADGES = {
  free: { name: 'Free', price: '$0', color: '#6B7280' },
  mini: { name: 'Mini', price: '$5', color: '#10B981' },
  pro:  { name: 'Pro',  price: '$9', color: '#0A1EFF' },
  max:  { name: 'Max',  price: '$15', color: '#F59E0B' },
} as const;

function CommandList({ items, accent }: { items: { cmd: string; desc: string }[]; accent: string }) {
  return (
    <div className="space-y-1.5">
      {items.map(c => (
        <div key={c.cmd} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2.5">
          <code className="text-xs font-mono px-2 py-0.5 rounded flex-shrink-0" style={{ background: accent + '20', color: accent }}>{c.cmd}</code>
          <span className="text-xs text-gray-400 leading-relaxed pt-0.5">{c.desc}</span>
        </div>
      ))}
    </div>
  );
}

export function DocsSection11() {
  return (
    <section id="telegram-bot" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">11</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Telegram Bot</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        @Nakalabsbot brings Naka Labs into Telegram · receive whale, price, and copy-trade alerts directly in your DMs, and run commands to look up tokens, wallets, and positions without leaving chat. Trading commands are gated by your subscription tier (same gates as the web app).
      </p>

      {/* Connect flow */}
      <div id="bot-connect" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-[#229ED9]" /> Connecting Your Account
        </h3>
        <div className="space-y-2">
          {CONNECT_STEPS.map(s => (
            <div key={s.n} className="flex gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <div className="w-6 h-6 rounded-full bg-[#229ED9]/15 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-[#229ED9]">{s.n}</span>
              </div>
              <div>
                <div className="text-xs font-semibold text-white">{s.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Commands by tier */}
      <div id="bot-commands" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Command className="w-4 h-4 text-[#0A1EFF]" /> Commands by Tier
        </h3>

        {([
          { key: 'free', items: FREE_COMMANDS },
          { key: 'mini', items: MINI_COMMANDS },
          { key: 'pro',  items: PRO_COMMANDS },
          { key: 'max',  items: MAX_COMMANDS },
        ] as const).map(({ key, items }) => {
          const t = TIER_BADGES[key];
          return (
            <div key={key} className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: t.color + '20', color: t.color }}>{t.name}</span>
                <span className="text-[10px] text-gray-500 font-mono">{t.price}/mo</span>
              </div>
              <CommandList items={[...items]} accent={t.color} />
            </div>
          );
        })}

        <div className="bg-amber-500/[0.05] border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2 mt-4">
          <Lock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div>
            Running a command above your tier returns a 🔒 notice with an <strong>Upgrade Plan</strong> button. Expired subscriptions auto-downgrade to Free until renewal.
          </div>
        </div>
      </div>

      {/* Outbound notifications */}
      <div id="bot-notifications" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#F59E0B]" /> Automatic Notifications
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Once linked, the platform pushes alerts to your Telegram based on your <strong className="text-gray-300">Settings → Notifications</strong> configuration. No commands needed.
        </p>
        <div className="space-y-2">
          {OUTBOUND_NOTIFS.map(n => (
            <div key={n.type} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2.5">
              <Zap className="w-3.5 h-3.5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-white">{n.type}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{n.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy note */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Send className="w-4 h-4 text-[#229ED9]" />
          <span className="text-sm font-semibold text-white">Privacy & Disconnect</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          We store only your Telegram chat ID and (optional) username, mapped to your Naka account. To disconnect at any time, send <code className="text-gray-300 font-mono">/unlink</code> to the bot or use the Disconnect button in <strong className="text-gray-300">Settings → Notifications</strong>. The link row is deleted immediately and no further messages are sent.
        </p>
      </div>
    </section>
  );
}
