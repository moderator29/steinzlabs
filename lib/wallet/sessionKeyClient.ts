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

// Audit #47 H1: domain carries chainId, struct carries a single-use server
// nonce. MUST match the server (app/api/trading/session-key/aa) byte-for-byte
// or the signature won't verify.
const AA_TYPED_DATA_TYPES = {
  Authorization: [
    { name: 'sessionAddress', type: 'address' },
    { name: 'kernelAddress', type: 'address' },
    { name: 'chain', type: 'string' },
    { name: 'maxPerTradeUsd', type: 'uint256' },
    { name: 'dailyCapUsd', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
    { name: 'nonce', type: 'string' },
  ],
};

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
  // 1. init — server mints + encrypts a session key, returns the ciphertext to
  //    round-trip and the scope to sign. No row is stored yet.
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
    session_address?: string; encrypted_session_key?: string; valid_until?: number;
    max_trades_per_day?: number; max_per_trade_usd?: number; daily_cap_usd?: number;
    nonce?: string; error?: string;
  };
  if (
    !initRes.ok || !init.session_address || !init.encrypted_session_key ||
    !init.valid_until || init.max_per_trade_usd == null || init.daily_cap_usd == null ||
    !init.nonce
  ) {
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

  // 3. sign the EIP-712 scope with the OWNER key (proves the main wallet
  //    authorized this exact session + kernel + caps + expiry), so the server
  //    can store the grant with on-record authorization (audit #47 C1).
  const { Wallet } = await import('ethers');
  const { aaChainFor } = await import('./sessionKeyAA');
  const authPayload = {
    sessionAddress: init.session_address,
    kernelAddress,
    chain: params.chain.toLowerCase(),
    maxPerTradeUsd: Math.floor(init.max_per_trade_usd),
    dailyCapUsd: Math.floor(init.daily_cap_usd),
    expiresAt: init.valid_until,
    nonce: init.nonce,
  };
  const domain = { name: 'NakaLabs AA Session Key', version: '1', chainId: aaChainFor(params.chain)?.id ?? 0 };
  const ownerWallet = new Wallet(ownerPk);
  const authSignature = await ownerWallet.signTypedData(
    domain,
    AA_TYPED_DATA_TYPES,
    authPayload,
  );

  // 4. persist the approval + authorization
  const apRes = await fetch('/api/trading/session-key/aa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      step: 'approve',
      chain: params.chain,
      main_address: params.mainAddress,
      session_address: init.session_address,
      encrypted_session_key: init.encrypted_session_key,
      approval,
      kernel_address: kernelAddress,
      auth_signature: authSignature,
      auth_payload: authPayload,
    }),
  });
  const ap = (await apRes.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
  if (!apRes.ok || !ap.ok || !ap.id) throw new Error(ap.error || 'Could not save the session approval.');

  return { kernelAddress, sessionId: ap.id, validUntil: init.valid_until };
}
