'use client';

/**
 * useSwapBroadcast — the platform's ONE swap signer, extracted from
 * `app/dashboard/swap/page.tsx` `handleSwap` so every surface (the swap
 * page, the VTX SwapCard, the coin-detail InlineBuySellForm, the multi-leg
 * SwapBatchCard) signs + broadcasts through the same audited path instead of
 * re-implementing it or — worse — faking success.
 *
 * It takes the executable quote blob a quote endpoint returns (a 0x/EVM
 * `transaction`, a Solana base64 `swapTransaction`, or a gasless EIP-712
 * `trade`/`approval`) and drives the wallet to sign + broadcast, returning a
 * REAL on-chain tx hash. Nothing here moves funds without a wallet signature.
 *
 * Built-in (Naka) wallets need the user's password to decrypt the stored key.
 * Rather than throw, `broadcast()` parks on an internal promise and surfaces
 * `unlockRequest`; the consumer renders an unlock modal and calls
 * `resolveUnlock(password)` (or `cancelUnlock()`), and the broadcast resumes.
 */

import { useCallback, useRef, useState } from 'react';
import { getWalletSessionKey } from '@/lib/wallet/walletSession';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

/** Which signer drives the signature for a given leg. */
export type WalletKind = 'ethereum' | 'solana' | 'builtin';

/** The executable blob a quote endpoint returns for client-side signing. */
export interface SwapBroadcastQuote {
  /** EVM swap tx (0x / aggregator) — sent via eth_sendTransaction or ethers. */
  transaction?: { to: string; data: string; value?: string; gas?: string };
  /** Solana base64 VersionedTransaction (Jupiter) — sent via the wallet. */
  swapTransaction?: string;
  /** Gasless EIP-712 trade typed-data (0x gasless). */
  trade?: unknown;
  /** Gasless EIP-712 approval typed-data (optional companion to `trade`). */
  approval?: unknown;
}

export interface BroadcastParams {
  quote: SwapBroadcastQuote;
  chain: string;
  walletKind: WalletKind;
  /** Connected wallet address (taker). */
  address: string;
  /** Gasless flow: sign EIP-712 + submit + poll instead of a raw send. */
  useGasless?: boolean;
}

export interface UnlockRequest {
  encryptedKey: string;
  addressShort?: string;
}

export type BroadcastStatus = 'idle' | 'signing' | 'submitted' | 'done' | 'error';

const CHAIN_RPCS: Record<string, string> = {
  ethereum: 'https://eth.llamarpc.com',
  base: 'https://mainnet.base.org',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  polygon: 'https://polygon-rpc.com',
  bsc: 'https://bsc-dataseed.binance.org',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
  optimism: 'https://mainnet.optimism.io',
};

function safeLocalGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalParse<T>(key: string, fallback: T): T {
  const raw = safeLocalGet(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function useSwapBroadcast() {
  const [status, setStatus] = useState<BroadcastStatus>('idle');
  const [unlockRequest, setUnlockRequest] = useState<UnlockRequest | null>(null);
  const unlockResolve = useRef<((pwd: string) => void) | null>(null);
  const unlockReject = useRef<((e: Error) => void) | null>(null);

  const requestUnlock = useCallback(
    (req: UnlockRequest) =>
      new Promise<string>((resolve, reject) => {
        setUnlockRequest(req);
        unlockResolve.current = resolve;
        unlockReject.current = reject;
      }),
    [],
  );

  /** Consumer calls this with the password from the unlock modal. */
  const resolveUnlock = useCallback((password: string) => {
    setUnlockRequest(null);
    const resolve = unlockResolve.current;
    unlockResolve.current = null;
    unlockReject.current = null;
    resolve?.(password);
  }, []);

  /** Consumer calls this if the user dismisses the unlock modal. */
  const cancelUnlock = useCallback(() => {
    setUnlockRequest(null);
    const reject = unlockReject.current;
    unlockResolve.current = null;
    unlockReject.current = null;
    reject?.(new Error('Wallet unlock cancelled'));
  }, []);

  const broadcastGasless = useCallback(async (quote: SwapBroadcastQuote): Promise<string> => {
    const win = typeof window !== 'undefined' ? window : null;
    if (!win?.ethereum) throw new Error('Gasless swaps require MetaMask or a compatible EVM wallet.');
    const accounts = (await win.ethereum.request({ method: 'eth_accounts' })) as string[];
    if (!accounts.length) throw new Error('No Ethereum wallet connected');

    const tradeSignature = await win.ethereum.request({
      method: 'eth_signTypedData_v4',
      params: [accounts[0], JSON.stringify(quote.trade)],
    });
    let approvalSignature: string | undefined;
    if (quote.approval) {
      approvalSignature = (await win.ethereum.request({
        method: 'eth_signTypedData_v4',
        params: [accounts[0], JSON.stringify(quote.approval)],
      })) as string;
    }
    const submitRes = await fetch('/api/gasless/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trade: quote.trade,
        tradeSignature,
        ...(approvalSignature ? { approval: quote.approval, approvalSignature } : {}),
      }),
    });
    const submitData = await submitRes.json();
    if (!submitRes.ok) throw new Error(submitData.error || 'Gasless submission failed');

    const tradeHash = submitData.tradeHash;
    let attempts = 0;
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(`/api/gasless/status?tradeHash=${tradeHash}`);
      const statusData = await statusRes.json();
      if (statusData.status === 'confirmed' && statusData.txHash) return statusData.txHash as string;
      if (statusData.status === 'failed') throw new Error('Gasless transaction failed on-chain');
      attempts++;
    }
    throw new Error('Gasless transaction timed out. Check your wallet for status.');
  }, []);

  const broadcastBuiltin = useCallback(
    async (quote: SwapBroadcastQuote, chain: string, address: string): Promise<string> => {
      if (!quote.transaction) {
        throw new Error('No transaction data to sign. Re-fetch the quote and try again.');
      }
      const storedWallets = safeLocalParse<Array<{ address?: string; encryptedKey?: string; iv?: string }>>('steinz_wallets', []);
      const activeAddr = safeLocalGet('steinz_active_wallet_address') || address;
      const storedWallet = storedWallets.find(
        (w) => w.address && activeAddr && normalizeAddress(w.address) === normalizeAddress(activeAddr),
      );
      if (!storedWallet?.encryptedKey) {
        throw new Error('No wallet keys found. Please re-import your wallet to sign transactions.');
      }

      let pwd = getWalletSessionKey() || '';
      if (!pwd) {
        // Park on the unlock modal; resumes when resolveUnlock() fires.
        pwd = await requestUnlock({
          encryptedKey: storedWallet.encryptedKey,
          addressShort: storedWallet.address
            ? `${storedWallet.address.slice(0, 6)}…${storedWallet.address.slice(-4)}`
            : undefined,
        });
      }
      if (!pwd) throw new Error('Wallet session expired. Please unlock your wallet.');

      let pk: string;
      try {
        if (!storedWallet.iv) {
          throw new Error(
            'This wallet uses an outdated encryption format. Please re-import the seed phrase from the Wallet page to upgrade to AES-256-GCM.',
          );
        }
        const keyMaterial = new TextEncoder().encode(pwd.padEnd(32).slice(0, 32));
        const cryptoKey = await crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, ['decrypt']);
        const iv = Uint8Array.from(atob(storedWallet.iv), (c) => c.charCodeAt(0));
        const encrypted = Uint8Array.from(atob(storedWallet.encryptedKey), (c) => c.charCodeAt(0));
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, encrypted);
        pk = new TextDecoder().decode(decrypted);
      } catch (err) {
        if (err instanceof Error && err.message.includes('outdated encryption format')) throw err;
        throw new Error('Failed to decrypt wallet key. Wrong password or corrupted data.');
      }

      const { ethers } = await import('ethers');
      const rpcUrl = CHAIN_RPCS[chain] || CHAIN_RPCS.ethereum;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const signer = new ethers.Wallet(pk, provider);
      const tx = await signer.sendTransaction(quote.transaction);
      return tx.hash;
    },
    [requestUnlock],
  );

  /**
   * Sign + broadcast a single quote. Returns the on-chain tx hash, or throws
   * with a user-facing message. For built-in wallets it may suspend on the
   * unlock modal (see `unlockRequest`).
   */
  const broadcast = useCallback(
    async ({ quote, chain, walletKind, address, useGasless }: BroadcastParams): Promise<string> => {
      setStatus('signing');
      try {
        let hash = '';
        const win = typeof window !== 'undefined' ? window : null;

        if (useGasless && quote.trade) {
          hash = await broadcastGasless(quote);
        } else if (walletKind === 'ethereum') {
          if (!win?.ethereum) throw new Error('Connect an EVM wallet (MetaMask / Reown) to sign this swap.');
          if (!quote.transaction) throw new Error('No transaction data received from the quote.');
          const accounts = (await win.ethereum.request({ method: 'eth_accounts' })) as string[];
          if (!accounts.length) throw new Error('No Ethereum wallet connected');
          const txParams = {
            from: accounts[0],
            to: quote.transaction.to,
            data: quote.transaction.data,
            value: quote.transaction.value,
            gas: quote.transaction.gas,
          };
          setStatus('submitted');
          hash = (await win.ethereum.request({ method: 'eth_sendTransaction', params: [txParams] })) as string;
        } else if (walletKind === 'solana') {
          if (!win?.solana) throw new Error('Connect a Solana wallet (Phantom) to sign this swap.');
          if (!quote.swapTransaction) throw new Error('No Solana transaction data received from the quote.');
          const { Transaction } = await import('@solana/web3.js');
          const txBytes = Buffer.from(quote.swapTransaction, 'base64');
          const tx = Transaction.from(txBytes);
          setStatus('submitted');
          const signed = await win.solana.signAndSendTransaction(tx);
          hash = signed.signature;
        } else if (walletKind === 'builtin') {
          setStatus('submitted');
          hash = await broadcastBuiltin(quote, chain, address);
        } else {
          throw new Error('Connect a wallet (MetaMask, Phantom, or built-in) to execute swaps.');
        }

        if (!hash) throw new Error('Transaction was not signed. Please try again.');
        setStatus('done');
        return hash;
      } catch (err) {
        setStatus('error');
        throw err instanceof Error ? err : new Error('Swap failed. Please try again.');
      }
    },
    [broadcastGasless, broadcastBuiltin],
  );

  const reset = useCallback(() => setStatus('idle'), []);

  return { broadcast, status, unlockRequest, resolveUnlock, cancelUnlock, reset };
}

/**
 * Map a connected wallet's provider + the target chain to the signer kind the
 * hook expects. Solana pages need Phantom; EVM pages prefer an injected wallet
 * and fall back to the built-in (Naka) signer.
 */
export function detectWalletKind(chain: string, provider: string | null): WalletKind {
  if (chain.toLowerCase() === 'solana') return 'solana';
  if (provider === 'metamask' || (typeof window !== 'undefined' && window.ethereum && provider !== 'naka')) {
    return 'ethereum';
  }
  return 'builtin';
}
