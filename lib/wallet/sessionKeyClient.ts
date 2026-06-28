'use client';

/**
 * Client helper to enable background (AA) sniping (#41).
 *
 * Orchestrates the three-step handshake without the owner key ever leaving the
 * browser or the session key ever reaching the client:
 *   1. init   → server mints + stores (encrypted) a limited session key,
 *               returns its address + on-chain scope.
 *   2. approve→ decrypt the owner's Naka key locally, sign the ZeroDev kernel
 *               permission approval for that session address, post it back.
 *   3. done   → the background cron can now broadcast capped, expiring buys.
 *
 * ZeroDev SDK is dynamically imported so it isn't bundled into every page.
 */

import { decryptPrivateKey } from './encryption';

export async function enableBackgroundSniping(params: {
  chain: string;
  mainAddress: string;
  encryptedKey: string;
  password: string;
  maxPerTradeUsd: number;
  dailyCapUsd: number;
  maxTradesPerDay?: number;
  hours?: number;
}): Promise<{ kernelAddress: string; sessionId: string; validUntil: number }> {
  // 1. init
  const initRes = await fetch('/api/trading/session-key/aa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      step: 'init',
      chain: params.chain,
      main_address: params.mainAddress,
      max_per_trade_usd: params.maxPerTradeUsd,
      daily_cap_usd: params.dailyCapUsd,
      max_trades_per_day: params.maxTradesPerDay,
      hours: params.hours,
    }),
  });
  const init = (await initRes.json().catch(() => ({}))) as {
    id?: string; session_address?: string; valid_until?: number; max_trades_per_day?: number; error?: string;
  };
  if (!initRes.ok || !init.id || !init.session_address || !init.valid_until) {
    throw new Error(init.error || 'Could not start background-sniping setup.');
  }

  // 2. decrypt owner key locally + build the kernel permission approval
  let ownerPk: string;
  try {
    ownerPk = await decryptPrivateKey(params.encryptedKey, params.password);
  } catch {
    throw new Error('Wrong wallet password — could not authorize the session.');
  }
  const { buildSessionKeyApproval } = await import('./sessionKeyAA');
  const { approval, kernelAddress } = await buildSessionKeyApproval({
    ownerPrivateKey: ownerPk as `0x${string}`,
    sessionAddress: init.session_address as `0x${string}`,
    chainSlug: params.chain,
    scope: { validUntil: init.valid_until, maxTradesPerDay: init.max_trades_per_day ?? 20 },
  });

  // 3. persist the approval
  const apRes = await fetch('/api/trading/session-key/aa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step: 'approve', id: init.id, approval, kernel_address: kernelAddress }),
  });
  const ap = (await apRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!apRes.ok || !ap.ok) throw new Error(ap.error || 'Could not save the session approval.');

  return { kernelAddress, sessionId: init.id, validUntil: init.valid_until };
}
