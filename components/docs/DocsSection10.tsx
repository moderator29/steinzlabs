import { Bell, Zap, Shield, Smartphone, Clock, Settings } from 'lucide-react';

const ALERT_TYPES = [
  { icon: Zap, color: '#F59E0B', title: 'Price Alerts', desc: 'Set a target price for any token. You will be notified the moment it crosses your threshold — above or below.' },
  { icon: Bell, color: '#0A1EFF', title: 'Whale Movement Alerts', desc: 'Get notified when a watched whale wallet makes a transaction above your configured USD threshold (min $10K).' },
  { icon: Shield, color: '#EF4444', title: 'Security Alerts', desc: 'Instant notification when a token in your portfolio drops below a Trust Score threshold or a new risk is detected.' },
  { icon: Zap, color: '#10B981', title: 'Smart Money Alerts', desc: 'Alert when 2+ smart money wallets buy the same token — the convergence signal delivered to your device.' },
  { icon: Bell, color: '#8B5CF6', title: 'Trend Alerts', desc: 'Notified when a monitored on-chain metric (TVL, stablecoin flow, active addresses) moves more than 10% in 24 hours.' },
];

const PUSH_STEPS = [
  { n: '1', title: 'Enable in Settings', desc: 'Go to Settings → Notifications and click "Enable Push Notifications". Your browser will ask for permission.' },
  { n: '2', title: 'Grant permission', desc: 'Accept the browser permission prompt. This allows the platform to send you alerts even when the tab is closed.' },
  { n: '3', title: 'Configure categories', desc: 'Choose which alert types you want as push notifications — price, whale, security, smart money, or trends.' },
  { n: '4', title: 'Set quiet hours', desc: 'Configure a quiet window (e.g. 11pm–7am) to pause non-critical alerts while you sleep.' },
];

export function DocsSection10() {
  return (
    <section id="alerts-notifications" className="mb-16 scroll-mt-20">
      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-5xl font-black text-white/[0.04] font-mono select-none leading-none">10</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">Alerts & Notifications</h2>
      </div>
      <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-8 mt-3">
        STEINZ LABS keeps you informed without keeping you glued to a screen. Configure price alerts, whale movement notifications, security events, and trend signals — delivered via push notification, in-app, or email.
      </p>

      {/* Alert types */}
      <div id="price-alerts" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#0A1EFF]" />Alert Types
        </h3>
        <div className="space-y-3">
          {ALERT_TYPES.map(({ icon: Icon, color, title, desc }) => (
            <div key={title} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '20' }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white mb-0.5">{title}</div>
                <div className="text-xs text-gray-400 leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Push Notifications */}
      <div id="push-notifications" className="scroll-mt-20 mb-10">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-[#10B981]" />Push Notifications Setup
        </h3>
        <p className="text-xs text-gray-400 leading-relaxed mb-4">
          Push notifications work on Chrome, Firefox, and Safari (iOS 16.4+) and are delivered via the Web Push standard — no app download required.
        </p>
        <div className="space-y-2 mb-6">
          {PUSH_STEPS.map(s => (
            <div key={s.n} className="flex gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <div className="w-6 h-6 rounded-full bg-[#10B981]/15 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-[#10B981]">{s.n}</span>
              </div>
              <div>
                <div className="text-xs font-semibold text-white">{s.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Alert limits */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {[
          { tier: 'Free', limit: '10 active alerts', color: '#6B7280' },
          { tier: 'Pro', limit: '50 active alerts', color: '#0A1EFF' },
          { tier: 'Enterprise', limit: 'Unlimited alerts', color: '#F59E0B' },
        ].map(t => (
          <div key={t.tier} className="bg-white/[0.02] border rounded-xl p-3 text-center" style={{ borderColor: t.color + '30' }}>
            <div className="text-xs font-bold mb-1" style={{ color: t.color }}>{t.tier}</div>
            <div className="text-xs text-gray-400">{t.limit}</div>
          </div>
        ))}
      </div>

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-white">Notification Settings</span>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          Manage all notification preferences from <strong className="text-gray-300">Settings → Notifications</strong>. Configure per-category toggles, quiet hours with timezone support, email backup delivery, and minimum threshold filters for each alert type.
        </p>
      </div>
    </section>
  );
}
