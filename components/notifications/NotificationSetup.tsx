'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Smartphone, Share, X, CheckCircle } from 'lucide-react';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function detectPWA(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
}

function getPermissionState(): PermissionState {
  if (typeof window === 'undefined' || !('PushManager' in window)) return 'unsupported';
  return (Notification.permission as PermissionState);
}

async function registerSubscription(session: string): Promise<boolean> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return false;

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey,
    });

    const res = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

interface Props {
  session?: string; // Supabase access token
  compact?: boolean; // smaller card for settings page
}

export default function NotificationSetup({ session, compact = false }: Props) {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [isIOS, setIsIOS] = useState(false);
  const [isPWA, setIsPWA] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    setPermission(getPermissionState());
    setIsIOS(detectIOS());
    setIsPWA(detectPWA());
    setDismissed(localStorage.getItem('ios-pwa-dismissed') === '1');
    if (getPermissionState() === 'granted') setSubscribed(true);
  }, []);

  async function requestPermission() {
    if (!session) return;
    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      if (result === 'granted') {
        await navigator.serviceWorker.register('/sw.js');
        const ok = await registerSubscription(session);
        setSubscribed(ok);
      }
    } finally {
      setLoading(false);
    }
  }

  if (permission === 'unsupported') return null;
  if (dismissed && !compact) return null;

  // iOS not in PWA mode
  if (isIOS && !isPWA) {
    if (dismissed && !compact) return null;
    return (
      <div className="bg-[#0f1320] border border-[#1a1f2e] rounded-2xl p-4 relative">
        {!compact && (
          <button onClick={() => { setDismissed(true); localStorage.setItem('ios-pwa-dismissed', '1'); }}
            className="absolute top-3 right-3 text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
        <div className="flex items-center gap-2 mb-3">
          <Smartphone className="w-4 h-4 text-[#0A1EFF]" />
          <span className="text-sm font-bold">Get Whale Alerts on iPhone</span>
        </div>
        <div className="space-y-2">
          {[
            { n: 1, icon: <Share className="w-3.5 h-3.5 text-[#0A1EFF]" />, text: 'Tap the Share button in Safari' },
            { n: 2, icon: <Smartphone className="w-3.5 h-3.5 text-[#0A1EFF]" />, text: 'Tap "Add to Home Screen"' },
            { n: 3, icon: <Bell className="w-3.5 h-3.5 text-[#0A1EFF]" />, text: 'Open Naka Labs from your home screen' },
            { n: 4, icon: <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />, text: 'Come back here to enable notifications' },
          ].map(step => (
            <div key={step.n} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#0A1EFF]/20 text-[#0A1EFF] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{step.n}</span>
              <div className="flex items-center gap-1.5">{step.icon}<span className="text-xs text-gray-300">{step.text}</span></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Permission granted
  if (permission === 'granted' && subscribed) {
    return (
      <div className="flex items-center gap-2 p-3 bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl">
        <CheckCircle className="w-4 h-4 text-[#10B981] flex-shrink-0" />
        <span className="text-xs text-[#10B981] font-semibold">Notifications active</span>
      </div>
    );
  }

  // Permission denied
  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
        <BellOff className="w-4 h-4 text-red-400 flex-shrink-0" />
        <span className="text-xs text-red-400">Notifications blocked. Enable in browser settings to receive alerts.</span>
      </div>
    );
  }

  // Default — request permission
  return (
    <div className="bg-[#0f1320] border border-[#1a1f2e] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Bell className="w-4 h-4 text-[#0A1EFF]" />
        <span className="text-sm font-bold">Get Instant Whale Alerts</span>
      </div>
      <p className="text-[11px] text-gray-400 mb-3">
        Know when whales move before the market reacts. Trades, convergence signals, and price alerts — right on your phone.
      </p>
      <button onClick={requestPermission} disabled={loading || !session}
        className="w-full bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2">
        <Bell className="w-3.5 h-3.5" />
        {loading ? 'Setting up...' : 'Enable Notifications'}
      </button>
    </div>
  );
}
