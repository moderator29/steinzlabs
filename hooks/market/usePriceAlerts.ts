'use client';

import { useState, useEffect, useCallback } from 'react';
import { PriceAlert, PriceAlertInput } from '@/lib/market/types';
import { POLLING_INTERVALS } from '@/lib/market/constants';

export function usePriceAlerts(userId: string | null, currentPrices: Record<string, number> = {}) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [triggered, setTriggered] = useState<PriceAlert | null>(null);

  useEffect(() => {
    if (!userId) return;
    window.fetch(`/api/market/alerts?userId=${userId}`)
      .then((r) => r.json())
      .then((d: { alerts?: PriceAlert[] }) => setAlerts(d.alerts ?? []))
      .catch(() => {});
  }, [userId]);

  // Evaluate alerts against current prices
  useEffect(() => {
    if (!alerts.length || !Object.keys(currentPrices).length) return;

    const id = setInterval(() => {
      for (const alert of alerts) {
        const price = currentPrices[alert.token_id];
        if (!price) continue;
        const hit = alert.direction === 'above' ? price >= alert.target_price : price <= alert.target_price;
        if (hit) {
          setTriggered(alert);
          setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
          window.fetch(`/api/market/alerts?id=${alert.id}`, { method: 'DELETE' }).catch(() => {});
        }
      }
    }, POLLING_INTERVALS.PRICE_ALERTS);

    return () => clearInterval(id);
  }, [alerts, currentPrices]);

  const addAlert = useCallback(async (input: PriceAlertInput) => {
    if (!userId) return;
    const res = await window.fetch('/api/market/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, userId }),
    });
    const d = await res.json() as { alert?: PriceAlert };
    if (d.alert) setAlerts((prev) => [...prev, d.alert!]);
  }, [userId]);

  const removeAlert = useCallback(async (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    await window.fetch(`/api/market/alerts?id=${id}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  const dismissTriggered = useCallback(() => setTriggered(null), []);

  return { alerts, triggered, addAlert, removeAlert, dismissTriggered };
}
