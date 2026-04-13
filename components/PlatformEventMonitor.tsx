'use client';

/**
 * PlatformEventMonitor — runs silently in the background from the dashboard layout.
 * Polls smart-money and whale-tracker APIs every 3 minutes.
 * Fires addLocalNotification for:
 *   - Smart-money convergence signals (≥2 wallets buying same token)
 *   - MEGA-tier whale moves detected by the whale tracker
 *
 * Deduplication: events are keyed in localStorage with a 1-hour TTL so the
 * same event never fires twice within an hour.
 */

import { useEffect, useRef } from 'react';
import { addLocalNotification } from '@/lib/notifications';

const SEEN_KEY = 'steinz_platform_events_seen';
const TTL_MS   = 60 * 60 * 1000; // 1 hour
const POLL_MS  = 3 * 60 * 1000;  // 3 minutes

function loadSeen(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveSeen(seen: Record<string, number>): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {}
}

function markSeen(key: string): void {
  const seen = loadSeen();
  // Prune stale entries first
  const now = Date.now();
  for (const k of Object.keys(seen)) {
    if (now - seen[k] > TTL_MS) delete seen[k];
  }
  seen[key] = now;
  saveSeen(seen);
}

function hasSeen(key: string): boolean {
  const seen = loadSeen();
  const ts = seen[key];
  if (!ts) return false;
  return Date.now() - ts < TTL_MS;
}

// ─── Smart-money convergence ──────────────────────────────────────────────────

interface ConvergenceSignal {
  token: string;
  symbol: string;
  walletCount: number;
  totalVolume: string;
  timeWindow: string;
}

async function checkSmartMoney(): Promise<void> {
  try {
    const res = await fetch('/api/smart-money', { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return;
    const data = await res.json() as { convergence?: ConvergenceSignal[] };
    const signals: ConvergenceSignal[] = data.convergence ?? [];

    for (const signal of signals) {
      const key = `convergence-${signal.token}-${signal.walletCount}`;
      if (hasSeen(key)) continue;

      markSeen(key);
      addLocalNotification({
        type: 'whale_alert',
        title: `Smart Money Convergence: ${signal.symbol || signal.token}`,
        message: `${signal.walletCount} top wallets entered ${signal.symbol || signal.token} — ${signal.totalVolume} combined volume (${signal.timeWindow})`,
      });
    }
  } catch {
    // Silently ignore — background task
  }
}

// ─── Whale tracker MEGA moves ─────────────────────────────────────────────────

interface WhaleProfile {
  id: string;
  name: string;
  address: string;
  shortAddress: string;
  tier: string;
  volumeStr: string;
  totalVolumeUsd: number;
  chain: string;
  lastActiveLabel: string;
}

async function checkWhaleTracker(): Promise<void> {
  try {
    const res = await fetch('/api/whale-tracker', { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return;
    const data = await res.json() as { whales?: WhaleProfile[] };
    const whales: WhaleProfile[] = (data.whales ?? []).filter(w => w.tier === 'MEGA');

    for (const whale of whales) {
      // Key by address + current hour so we alert at most once per hour per whale
      const hourSlot = Math.floor(Date.now() / (60 * 60 * 1000));
      const key = `whale-${whale.address || whale.id}-${hourSlot}`;
      if (hasSeen(key)) continue;

      markSeen(key);
      addLocalNotification({
        type: 'whale_alert',
        title: `MEGA Whale Active: ${whale.name}`,
        message: `${whale.shortAddress || whale.name} is active on ${whale.chain} — ${whale.volumeStr} tracked volume`,
      });
    }
  } catch {
    // Silently ignore — background task
  }
}

// ─── Main hook ────────────────────────────────────────────────────────────────

export default function PlatformEventMonitor() {
  const tickRef = useRef(0);

  useEffect(() => {
    // Stagger first run by 15s to avoid hitting APIs right on mount
    const initialTimer = setTimeout(() => {
      checkSmartMoney();
      checkWhaleTracker();
    }, 15_000);

    const interval = setInterval(() => {
      tickRef.current++;
      checkSmartMoney();
      checkWhaleTracker();
    }, POLL_MS);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  return null;
}
