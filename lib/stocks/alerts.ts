'use client';

/**
 * Stock price alerts client. Backed by the server (`/api/stocks/alerts` + the
 * stock-alerts cron), so an alert fires as an in-app notification EVEN WHEN the
 * app is closed and syncs across a user's devices. Thin async wrappers over the
 * API; all failures resolve to safe empty results so the UI never throws.
 */

export interface StockAlert {
  id: string;
  symbol: string;
  name: string | null;
  target: number;
  direction: 'above' | 'below';
  active: boolean;
  fired_at: string | null;
  created_at: string;
}

export async function getAlerts(): Promise<StockAlert[]> {
  try {
    const r = await fetch('/api/stocks/alerts', { cache: 'no-store' });
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j.alerts) ? j.alerts : [];
  } catch {
    return [];
  }
}

export async function alertsForSymbol(symbol: string): Promise<StockAlert[]> {
  const all = await getAlerts();
  return all.filter((a) => a.symbol === symbol);
}

export async function addAlert(a: { symbol: string; name: string | null; target: number; direction: 'above' | 'below' }): Promise<StockAlert | null> {
  try {
    const r = await fetch('/api/stocks/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(a),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.alert ?? null;
  } catch {
    return null;
  }
}

export async function removeAlert(id: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/stocks/alerts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    return r.ok;
  } catch {
    return false;
  }
}
