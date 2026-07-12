'use client';

/**
 * On-device stock price alerts. Stored per signed-in user in localStorage. While
 * the Stocks board is open it refreshes prices every minute and fires a browser
 * notification + toast when a target is crossed, then marks the alert fired.
 * Honest + clear: these are device-local, live-while-open alerts (no server cron
 * needed), which is exactly what a "watch this price" alert should feel like in
 * the app.
 */

export interface StockAlert {
  id: string;
  symbol: string;
  name: string;
  target: number;
  direction: 'above' | 'below';
  createdAt: number;
  firedAt?: number;
}

function key(uid: string | null): string | null {
  return uid ? `nl-stock-alerts:${uid}` : null;
}

export function getAlerts(uid: string | null): StockAlert[] {
  const k = key(uid);
  if (!k || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(k);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(uid: string | null, alerts: StockAlert[]): void {
  const k = key(uid);
  if (!k || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(k, JSON.stringify(alerts));
  } catch {
    /* storage full / unavailable */
  }
}

export function addAlert(uid: string | null, a: Omit<StockAlert, 'id' | 'createdAt'>): StockAlert[] {
  const list = getAlerts(uid);
  const id = `${a.symbol}-${a.direction}-${a.target}`;
  const next = [...list.filter((x) => x.id !== id), { ...a, id, createdAt: Date.now() }];
  save(uid, next);
  return next;
}

export function removeAlert(uid: string | null, id: string): StockAlert[] {
  const next = getAlerts(uid).filter((a) => a.id !== id);
  save(uid, next);
  return next;
}

export function alertsForSymbol(uid: string | null, symbol: string): StockAlert[] {
  return getAlerts(uid).filter((a) => a.symbol === symbol);
}

/**
 * Check every armed alert against the latest prices and fire the ones that
 * crossed. Returns the list of alerts that fired this pass (for a toast).
 */
export function checkAlerts(uid: string | null, priceBySymbol: Map<string, number>): StockAlert[] {
  const list = getAlerts(uid);
  if (list.length === 0) return [];
  const fired: StockAlert[] = [];
  let changed = false;
  for (const a of list) {
    if (a.firedAt) continue;
    const price = priceBySymbol.get(a.symbol);
    if (price == null) continue;
    const cross = a.direction === 'above' ? price >= a.target : price <= a.target;
    if (cross) {
      a.firedAt = Date.now();
      fired.push(a);
      changed = true;
    }
  }
  if (changed) save(uid, list);
  return fired;
}
