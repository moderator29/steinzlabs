'use client';

import { useEffect, useRef } from 'react';
import { addLocalNotification } from '@/lib/notifications';

export type AlertChain = 'solana' | 'ethereum' | 'bsc' | 'base';

export interface WhaleAlert {
  id: string;
  type: 'whale';
  name: string;
  walletAddress: string;
  threshold: number;
  chain: AlertChain;
  active: boolean;
  lastChecked: number;
  lastTxHash?: string;
  createdAt: string;
  lastTriggered?: number;
  triggerCount: number;
}

export interface PriceAlert {
  id: string;
  type: 'price';
  name: string;
  tokenId: string;
  tokenSymbol: string;
  direction: 'above' | 'below';
  targetPrice: number;
  active: boolean;
  createdAt: string;
  lastTriggered?: number;
  triggerCount: number;
}

export interface NewLaunchAlert {
  id: string;
  type: 'launch';
  name: string;
  minLiquidity: number;
  minHolders: number;
  chain: 'solana' | 'any';
  keywords: string[];
  active: boolean;
  lastChecked: number;
  createdAt: string;
  lastTriggered?: number;
  triggerCount: number;
}

export interface WalletActivityAlert {
  id: string;
  type: 'wallet_activity';
  name: string;
  walletAddress: string;
  chain: AlertChain;
  active: boolean;
  lastChecked: number;
  lastTxHash?: string;
  createdAt: string;
  lastTriggered?: number;
  triggerCount: number;
}

export type SmartAlert = WhaleAlert | PriceAlert | NewLaunchAlert | WalletActivityAlert;

export const ALERTS_KEY = 'steinz_alerts';
export const ALERT_HISTORY_KEY = 'steinz_alert_history';

export interface AlertHistoryEntry {
  id: string;
  alertId: string;
  alertName: string;
  alertType: string;
  message: string;
  triggeredAt: number;
}

export function loadSmartAlerts(): SmartAlert[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(ALERTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveSmartAlerts(alerts: SmartAlert[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  } catch (err) {
    console.error('[saveSmartAlerts] Failed to persist alerts:', err);
  }
}

export function loadAlertHistory(): AlertHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(ALERT_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addAlertHistory(entry: Omit<AlertHistoryEntry, 'id'>): void {
  if (typeof window === 'undefined') return;
  try {
    const history = loadAlertHistory();
    const newEntry: AlertHistoryEntry = { ...entry, id: `hist-${Date.now()}-${crypto.randomUUID().slice(0, 8)}` };
    history.unshift(newEntry);
    localStorage.setItem(ALERT_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  } catch (err) {
    console.error('[addAlertHistory] Failed to persist alert history:', err);
  }
}

function fireAlert(alert: SmartAlert, message: string): void {
  addLocalNotification({ type: 'alert', title: alert.name, message });
  addAlertHistory({ alertId: alert.id, alertName: alert.name, alertType: alert.type, message, triggeredAt: Date.now() });
  window.dispatchEvent(new CustomEvent('steinz_alert_triggered', { detail: { alertId: alert.id } }));
}

function updateAlert(alertId: string, updates: Partial<SmartAlert>): void {
  const alerts = loadSmartAlerts();
  const idx = alerts.findIndex(a => a.id === alertId);
  if (idx >= 0) {
    alerts[idx] = { ...alerts[idx], ...updates } as SmartAlert;
    saveSmartAlerts(alerts);
  }
}

// ── Price Alert Monitor ──────────────────────────────────────────────────────

async function checkPriceAlerts(alerts: SmartAlert[]): Promise<void> {
  const priceAlerts = alerts.filter(a => a.type === 'price' && a.active) as PriceAlert[];
  if (!priceAlerts.length) return;

  const tokenIds = [...new Set(priceAlerts.map(a => a.tokenId))].join(',');
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${tokenIds}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return;
    const data: Record<string, { usd: number }> = await res.json();

    for (const alert of priceAlerts) {
      const price = data[alert.tokenId]?.usd;
      if (price == null) continue;

      const triggered =
        (alert.direction === 'above' && price >= alert.targetPrice) ||
        (alert.direction === 'below' && price <= alert.targetPrice);

      if (triggered) {
        const dir = alert.direction === 'above' ? 'surpassed' : 'dropped below';
        const msg = `${alert.tokenSymbol.toUpperCase()} ${dir} $${alert.targetPrice.toLocaleString()} — now at $${price.toLocaleString()}`;
        fireAlert(alert, msg);
        // Deactivate one-shot price alerts
        updateAlert(alert.id, { active: false, lastTriggered: Date.now(), triggerCount: alert.triggerCount + 1 } as Partial<PriceAlert>);
      }
    }
  } catch (err) {
    console.error('[checkPriceAlerts] Price check failed:', err);
  }
}

// ── Whale / Wallet Activity Monitor ─────────────────────────────────────────

function evmApiBase(chain: AlertChain): string {
  switch (chain) {
    case 'bsc': return 'https://api.bscscan.com/api';
    case 'base': return 'https://api.basescan.org/api';
    default: return 'https://api.etherscan.io/api';
  }
}

async function checkEVMWallet(alert: WhaleAlert | WalletActivityAlert): Promise<void> {
  const threshold = alert.type === 'whale' ? alert.threshold : 0;
  const base = evmApiBase(alert.chain);
  const ETHERSCAN_KEY = (process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY as string) || '';
  const url = `${base}?module=account&action=txlist&address=${alert.walletAddress}&sort=desc&page=1&offset=5${ETHERSCAN_KEY ? `&apikey=${ETHERSCAN_KEY}` : ''}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return;
    const data = await res.json();
    if (data.status !== '1' || !Array.isArray(data.result)) return;

    const txs: { hash: string; timeStamp: string; value: string }[] = data.result;
    const lastChecked = alert.lastChecked || 0;

    for (const tx of txs) {
      const txTime = parseInt(tx.timeStamp) * 1000;
      if (txTime <= lastChecked) break;
      if (tx.hash === alert.lastTxHash) break;

      const valueEth = parseInt(tx.value) / 1e18;
      const valueUsd = valueEth * 2000; // rough ETH price estimate for threshold check

      if (alert.type === 'wallet_activity' || valueUsd >= threshold) {
        const short = `${alert.walletAddress.slice(0, 6)}...${alert.walletAddress.slice(-4)}`;
        const msg = alert.type === 'whale'
          ? `Whale wallet ${short} moved ~$${Math.round(valueUsd).toLocaleString()} on ${alert.chain.toUpperCase()}`
          : `Wallet ${short} has new activity on ${alert.chain.toUpperCase()}`;
        fireAlert(alert, msg);
        updateAlert(alert.id, {
          lastChecked: Date.now(),
          lastTxHash: txs[0].hash,
          lastTriggered: Date.now(),
          triggerCount: alert.triggerCount + 1,
        } as Partial<WhaleAlert>);
        return; // fire once per check cycle
      }
    }

    // Update lastChecked even if no trigger
    updateAlert(alert.id, { lastChecked: Date.now() } as Partial<WhaleAlert>);
  } catch (err) {
    console.error('[checkEVMWallet] EVM wallet check failed:', err);
  }
}

async function checkSolanaWallet(alert: WhaleAlert | WalletActivityAlert): Promise<void> {
  const threshold = alert.type === 'whale' ? alert.threshold : 0;
  try {
    const res = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [
          alert.walletAddress,
          { limit: 5 },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return;
    const data = await res.json();
    const signatures: { signature: string; blockTime: number }[] = data?.result || [];
    if (!signatures.length) return;

    const lastChecked = alert.lastChecked || 0;
    const newSigs = signatures.filter(s => (s.blockTime * 1000) > lastChecked && s.signature !== alert.lastTxHash);

    if (newSigs.length > 0) {
      const short = `${alert.walletAddress.slice(0, 6)}...${alert.walletAddress.slice(-4)}`;
      const msg = alert.type === 'whale'
        ? `Whale wallet ${short} has ${newSigs.length} new transaction(s) on Solana`
        : `Wallet ${short} has new activity on Solana`;
      fireAlert(alert, msg);
      updateAlert(alert.id, {
        lastChecked: Date.now(),
        lastTxHash: signatures[0].signature,
        lastTriggered: Date.now(),
        triggerCount: alert.triggerCount + 1,
      } as Partial<WhaleAlert>);
    } else {
      updateAlert(alert.id, { lastChecked: Date.now() } as Partial<WhaleAlert>);
    }
  } catch (err) {
    console.error('[checkSolanaWallet] Solana wallet check failed:', err);
  }
}

async function checkWalletAlerts(alerts: SmartAlert[]): Promise<void> {
  const walletAlerts = alerts.filter(
    a => (a.type === 'whale' || a.type === 'wallet_activity') && a.active
  ) as (WhaleAlert | WalletActivityAlert)[];

  for (const alert of walletAlerts) {
    if (alert.chain === 'solana') {
      await checkSolanaWallet(alert);
    } else {
      await checkEVMWallet(alert);
    }
  }
}

// ── New Token Launch Monitor ─────────────────────────────────────────────────

async function checkLaunchAlerts(alerts: SmartAlert[]): Promise<void> {
  const launchAlerts = alerts.filter(a => a.type === 'launch' && a.active) as NewLaunchAlert[];
  if (!launchAlerts.length) return;

  try {
    const res = await fetch(
      'https://frontend-api.pump.fun/coins?sort=created_timestamp&order=DESC&limit=20',
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return;
    const coins: any[] = await res.json();
    if (!Array.isArray(coins)) return;

    for (const alert of launchAlerts) {
      const lastChecked = alert.lastChecked || 0;
      const newCoins = coins.filter((c: any) => (c.created_timestamp || 0) > lastChecked);

      for (const coin of newCoins) {
        const liquidity = coin.usd_market_cap || coin.market_cap || 0;
        const holders = coin.holder_count || coin.holders || 0;

        if (liquidity < alert.minLiquidity) continue;
        if (holders < alert.minHolders) continue;

        if (alert.keywords.length > 0) {
          const name = (coin.name || '').toLowerCase();
          const symbol = (coin.symbol || '').toLowerCase();
          const matched = alert.keywords.some(k => name.includes(k.toLowerCase()) || symbol.includes(k.toLowerCase()));
          if (!matched) continue;
        }

        const mcapStr = liquidity >= 1e6
          ? `$${(liquidity / 1e6).toFixed(1)}M`
          : `$${Math.round(liquidity / 1000)}K`;

        const msg = `New token: ${coin.name} (${coin.symbol?.toUpperCase()}) launched with ${mcapStr} market cap — CA: ${coin.mint?.slice(0, 8)}...`;
        fireAlert(alert, msg);
        updateAlert(alert.id, {
          lastChecked: (coin.created_timestamp || Date.now()),
          lastTriggered: Date.now(),
          triggerCount: alert.triggerCount + 1,
        } as Partial<NewLaunchAlert>);
        break; // one notification per cycle per alert
      }

      if (newCoins.length > 0) {
        const latest = Math.max(...newCoins.map((c: any) => c.created_timestamp || 0));
        if (latest > alert.lastChecked) {
          updateAlert(alert.id, { lastChecked: latest } as Partial<NewLaunchAlert>);
        }
      }
    }
  } catch (err) {
    console.error('[checkLaunchAlerts] Launch check failed:', err);
  }
}

// ── Main Hook ────────────────────────────────────────────────────────────────

export function useAlertMonitor() {
  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const walletIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const launchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Price alerts: every 30 seconds
    const runPriceCheck = () => {
      const alerts = loadSmartAlerts();
      checkPriceAlerts(alerts).catch(err => console.error('[useAlertMonitor] Price check error:', err));
    };
    runPriceCheck();
    priceIntervalRef.current = setInterval(runPriceCheck, 30_000);

    // Wallet alerts: every 60 seconds
    const runWalletCheck = () => {
      const alerts = loadSmartAlerts();
      checkWalletAlerts(alerts).catch(err => console.error('[useAlertMonitor] Wallet check error:', err));
    };
    runWalletCheck();
    walletIntervalRef.current = setInterval(runWalletCheck, 60_000);

    // Launch alerts: every 60 seconds
    const runLaunchCheck = () => {
      const alerts = loadSmartAlerts();
      checkLaunchAlerts(alerts).catch(err => console.error('[useAlertMonitor] Launch check error:', err));
    };
    runLaunchCheck();
    launchIntervalRef.current = setInterval(runLaunchCheck, 60_000);

    return () => {
      if (priceIntervalRef.current) clearInterval(priceIntervalRef.current);
      if (walletIntervalRef.current) clearInterval(walletIntervalRef.current);
      if (launchIntervalRef.current) clearInterval(launchIntervalRef.current);
    };
  }, []);
}
