'use client';

/**
 * NotificationSettingsPanel — Phase B (profile features).
 *
 * Replaces the localStorage-only notification toggles in ProfileTab
 * with a Supabase-backed, channel-aware, quiet-hours-aware control
 * surface. Drops into the existing 'preferences' / 'notifications'
 * sub-page.
 *
 * Industry parity: Linear / Stripe / Vercel all ship the same matrix
 * (channel × event) plus quiet hours and a "test notification" button.
 *
 * Composition:
 *   - Channels (Push / Email / Telegram) — each is enable/disable
 *     plus a trailing affordance (subscribe browser push, link
 *     telegram, etc).
 *   - Events (Whale / Smart Money / Price / Security / Weekly digest)
 *     each toggleable independently.
 *   - Quiet hours — start/end minute fields, timezone-aware.
 *   - Test notification button.
 */

import { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCircle2, Loader2, Mail, MoonStar, Send, ShieldCheck, Smartphone, Volume2, AlertTriangle, ExternalLink } from 'lucide-react';
import { useNotificationSettings } from '@/lib/preferences/notificationSettings';
import {
  isPushSupported, getNotificationPermission,
  subscribeToPush, unsubscribeFromPush, showLocalTestNotification,
} from '@/lib/preferences/webPush';

interface Props {
  userId: string | null;
}

function minutesToTimeString(min: number): string {
  const hh = Math.floor(min / 60).toString().padStart(2, '0');
  const mm = Math.floor(min % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function timeStringToMinutes(s: string): number {
  const [hh, mm] = s.split(':').map((p) => parseInt(p, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
  return Math.min(1439, Math.max(0, hh * 60 + mm));
}

interface ChannelRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  trailingAction?: React.ReactNode;
  disabled?: boolean;
  disabledReason?: string;
}

function ChannelRow({ icon, label, description, enabled, onToggle, trailingAction, disabled, disabledReason }: ChannelRowProps) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors ${
      disabled
        ? 'bg-slate-950/40 border-slate-800/40 opacity-60'
        : 'bg-slate-950/60 border-slate-800/70 hover:border-slate-700/80'
    }`}>
      <div className="mt-0.5 w-9 h-9 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-center flex-shrink-0 text-slate-300">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">{label}</span>
          {enabled && !disabled && <span className="text-[10px] uppercase tracking-wide text-emerald-400 font-bold">On</span>}
        </div>
        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{disabled ? disabledReason ?? description : description}</p>
        {trailingAction && <div className="mt-2">{trailingAction}</div>}
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 mt-1 ${
          enabled ? 'bg-emerald-500' : 'bg-slate-800'
        } ${disabled ? 'cursor-not-allowed' : 'hover:opacity-90'}`}
        aria-pressed={enabled}
        aria-label={`Toggle ${label}`}
      >
        <span className={`absolute top-0.5 ${enabled ? 'left-[18px]' : 'left-0.5'} w-5 h-5 rounded-full bg-white shadow transition-all`} />
      </button>
    </div>
  );
}

interface EventRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

function EventRow({ icon, label, description, enabled, onToggle }: EventRowProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-slate-800 transition-all text-start"
      aria-pressed={enabled}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        enabled
          ? 'bg-[#0A1EFF]/15 text-[#8FA3FF] border border-[#0A1EFF]/30'
          : 'bg-slate-900/60 text-slate-500 border border-slate-800'
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-[11px] text-slate-500 leading-snug">{description}</div>
      </div>
      <div className={`w-8 h-5 rounded-full transition-colors relative flex-shrink-0 ${enabled ? 'bg-[#0A1EFF]' : 'bg-slate-800'}`}>
        <span className={`absolute top-0.5 ${enabled ? 'left-[14px]' : 'left-0.5'} w-4 h-4 rounded-full bg-white shadow transition-all`} />
      </div>
    </button>
  );
}

export default function NotificationSettingsPanel({ userId }: Props) {
  const { settings, loading, hasExtendedSchema, update } = useNotificationSettings(userId);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setPushPermission(getNotificationPermission());
  }, []);

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 me-2 animate-spin" /> Loading notification settings…
      </div>
    );
  }

  const handlePushToggle = async () => {
    if (!userId) return;
    setPushBusy(true);
    setPushError(null);
    try {
      if (settings.push_enabled) {
        await unsubscribeFromPush();
        await update({ push_enabled: false });
      } else {
        const result = await subscribeToPush(userId);
        if (!result.ok) {
          const msg = result.reason === 'unsupported' ? 'Push notifications are not supported in this browser.'
            : result.reason === 'denied' ? 'Permission denied. Allow notifications in your browser settings to receive push.'
            : result.reason === 'missing_vapid' ? 'Push isn\'t configured on this environment yet.'
            : result.error ?? 'Subscription failed.';
          setPushError(msg);
          return;
        }
        await update({ push_enabled: true });
        setPushPermission('granted');
      }
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Toggle failed');
    } finally {
      setPushBusy(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try { await showLocalTestNotification(); } finally { setTimeout(() => setTesting(false), 600); }
  };

  const supportsPush = isPushSupported();

  return (
    <div className="space-y-6">
      {/* Channels */}
      <section className="space-y-2">
        <header className="flex items-baseline justify-between mb-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">Delivery channels</h3>
          {settings.push_enabled && (
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing}
              className="text-[11px] inline-flex items-center gap-1 text-[#6F7EFF] hover:text-[#8FA3FF] disabled:opacity-50"
            >
              <Volume2 size={11} /> {testing ? 'Sent' : 'Test push'}
            </button>
          )}
        </header>

        <ChannelRow
          icon={settings.push_enabled ? <Bell size={15} /> : <BellOff size={15} />}
          label="Browser push"
          description={
            !supportsPush
              ? 'Your browser doesn\'t support Web Push. Try a recent Chrome / Edge / Firefox.'
              : pushPermission === 'denied'
                ? 'You\'ve blocked notifications in your browser. Re-enable in site settings to subscribe.'
                : 'Native OS notifications when the tab is closed. Off by default; click to subscribe.'
          }
          enabled={settings.push_enabled}
          onToggle={() => void handlePushToggle()}
          disabled={!supportsPush || pushBusy}
          disabledReason={!supportsPush ? 'Web Push unavailable in this browser.' : undefined}
          trailingAction={pushError ? (
            <p className="inline-flex items-start gap-1 text-[11px] text-amber-300">
              <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" /> {pushError}
            </p>
          ) : pushPermission === 'denied' ? (
            <a
              href="https://support.google.com/chrome/answer/3220216"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[#6F7EFF] hover:text-[#8FA3FF]"
            >
              How to re-enable <ExternalLink size={10} />
            </a>
          ) : null}
        />

        <ChannelRow
          icon={<Mail size={15} />}
          label="Email digest"
          description={
            hasExtendedSchema
              ? 'Receive triggered events and the optional weekly digest by email.'
              : 'Pending — apply the notification_quiet_hours migration to enable.'
          }
          enabled={!!settings.email_enabled}
          onToggle={() => void update({ email_enabled: !settings.email_enabled })}
          disabled={!hasExtendedSchema}
        />

        <ChannelRow
          icon={<Send size={15} />}
          label="Telegram"
          description={
            hasExtendedSchema
              ? 'Push alerts to your linked Telegram. Link it in Profile > Telegram first.'
              : 'Pending — apply the notification_quiet_hours migration to enable.'
          }
          enabled={!!settings.telegram_enabled}
          onToggle={() => void update({ telegram_enabled: !settings.telegram_enabled })}
          disabled={!hasExtendedSchema}
        />
      </section>

      {/* Events */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1.5">Events</h3>
        <div className="space-y-1 rounded-xl bg-slate-950/40 border border-slate-800/60 p-1.5">
          <EventRow
            icon={<Bell size={14} />}
            label="Whale alerts"
            description="Large on-chain moves on tokens you watch."
            enabled={settings.whale_alerts}
            onToggle={() => void update({ whale_alerts: !settings.whale_alerts })}
          />
          <EventRow
            icon={<CheckCircle2 size={14} />}
            label="Smart money flow"
            description="Buys + sells from tracked Smart Money wallets."
            enabled={settings.smart_money}
            onToggle={() => void update({ smart_money: !settings.smart_money })}
          />
          <EventRow
            icon={<Volume2 size={14} />}
            label="Price alerts"
            description="Triggered alerts you've set on tokens."
            enabled={settings.price_alerts}
            onToggle={() => void update({ price_alerts: !settings.price_alerts })}
          />
          <EventRow
            icon={<ShieldCheck size={14} />}
            label="Security alerts"
            description="Suspicious approvals, signature requests, honeypot blocks."
            enabled={settings.security_alerts}
            onToggle={() => void update({ security_alerts: !settings.security_alerts })}
          />
          <EventRow
            icon={<Mail size={14} />}
            label="Weekly digest"
            description="A summary of your portfolio + watchlist every Monday."
            enabled={settings.weekly_digest}
            onToggle={() => void update({ weekly_digest: !settings.weekly_digest })}
          />
        </div>
      </section>

      {/* Quiet hours */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1.5">Do not disturb</h3>
        <div className={`rounded-xl border p-4 ${
          hasExtendedSchema ? 'bg-slate-950/60 border-slate-800/70' : 'bg-slate-950/40 border-slate-800/40 opacity-60'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MoonStar size={15} className="text-slate-400" />
              <div>
                <div className="text-sm font-semibold text-white">Quiet hours</div>
                <div className="text-[11px] text-slate-500">No push or email notifications during this window.</div>
              </div>
            </div>
            <button
              type="button"
              disabled={!hasExtendedSchema}
              onClick={() => void update({ quiet_hours_enabled: !settings.quiet_hours_enabled })}
              className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                settings.quiet_hours_enabled ? 'bg-emerald-500' : 'bg-slate-800'
              } ${!hasExtendedSchema ? 'cursor-not-allowed opacity-60' : ''}`}
              aria-pressed={!!settings.quiet_hours_enabled}
            >
              <span className={`absolute top-0.5 ${settings.quiet_hours_enabled ? 'left-[18px]' : 'left-0.5'} w-5 h-5 rounded-full bg-white shadow transition-all`} />
            </button>
          </div>

          {hasExtendedSchema ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px] text-slate-400">
                Start
                <input
                  type="time"
                  value={minutesToTimeString(settings.quiet_hours_start_minute ?? 1320)}
                  onChange={(e) => void update({ quiet_hours_start_minute: timeStringToMinutes(e.target.value) })}
                  disabled={!settings.quiet_hours_enabled}
                  className="mt-1 w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#0A1EFF]/40 disabled:opacity-60"
                />
              </label>
              <label className="text-[11px] text-slate-400">
                End
                <input
                  type="time"
                  value={minutesToTimeString(settings.quiet_hours_end_minute ?? 420)}
                  onChange={(e) => void update({ quiet_hours_end_minute: timeStringToMinutes(e.target.value) })}
                  disabled={!settings.quiet_hours_enabled}
                  className="mt-1 w-full bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#0A1EFF]/40 disabled:opacity-60"
                />
              </label>
              <div className="col-span-2 flex items-center gap-2 mt-1 text-[11px]">
                <Smartphone size={11} className="text-slate-500" />
                <span className="text-slate-500">Timezone:</span>
                <span className="text-slate-300 font-mono">{settings.quiet_hours_timezone}</span>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Apply <code className="text-[10px] bg-slate-900/80 px-1.5 py-0.5 rounded">supabase/migrations/2026_05_15_notification_quiet_hours.sql</code> to enable quiet hours, email channel, and Telegram channel toggles.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
