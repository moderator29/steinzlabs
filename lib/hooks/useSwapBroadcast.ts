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
import { getAccount } from '@wagmi/core';
import { ProviderController } from '@reown/appkit-controllers';
import { getWalletSessionKey, setWalletSessionKey } from '@/lib/wallet/walletSession';
import { normalizeAddress } from '@/lib/utils/addressNormalize';
import { decryptPrivateKey } from '@/lib/wallet/encryption';
import { wagmiAdapter } from '@/lib/wallet/appkit';

/** Minimal EIP-1193 surface we use for EVM signing. */
type Eip1193 = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

/** Minimal Solana wallet surface we use for signing. Phantom and the AppKit/
 *  WalletConnect Solana provider both expose signAndSendTransaction; the return
 *  shape varies ({ signature } or a bare string), so callers normalize it. */
type SolanaSigner = { signAndSendTransaction: (tx: unknown) => Promise<{ signature?: string } | string> };

/**
 * Resolve the active EVM provider. Prefers the wagmi/AppKit connector — which
 * covers an injected extension on desktop (MetaMask/Rabby) AND a WalletConnect
 * session on macOS/Windows/tablet/mobile — and falls back to an injected
 * window.ethereum when AppKit isn't configured. This is the fix that lets a
 * phone connected via the WalletConnect QR actually sign: window.ethereum is
 * undefined there, so the old code could only sign with a desktop extension.
 */
export async function getEvmProvider(): Promise<Eip1193 | null> {
  try {
    const cfg = wagmiAdapter?.wagmiConfig;
    if (cfg) {
      const acct = getAccount(cfg);
      if (acct.isConnected && acct.connector?.getProvider) {
        const p = (await acct.connector.getProvider()) as Eip1193 | undefined;
        if (p && typeof p.request === 'function') return p;
      }
    }
  } catch {
    /* fall back to an injected provider below */
  }
  const win = typeof window !== 'undefined' ? window : null;
  return (win?.ethereum as Eip1193 | undefined) ?? null;
}

/**
 * Resolve the active Solana signer. Prefers the AppKit-managed provider (which
 * is what a WalletConnect session on mobile/tablet uses — there is no
 * window.solana there), and falls back to an injected window.solana (Phantom on
 * desktop, the path the app's own Solana connect button uses). Mirrors
 * getEvmProvider so Solana swaps work on the same set of devices as EVM.
 */
export async function getSolanaProvider(): Promise<SolanaSigner | null> {
  try {
    const p = ProviderController.state.providers?.solana as SolanaSigner | undefined;
    if (p && typeof p.signAndSendTransaction === 'function') return p;
  } catch {
    /* fall back to an injected provider below */
  }
  const win = typeof window !== 'undefined' ? window : null;
  return (win?.solana as SolanaSigner | undefined) ?? null;
}

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
    const provider = await getEvmProvider();
    if (!provider) throw new Error('Gasless swaps require an EVM wallet (extension or WalletConnect).');
    const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
    if (!accounts.length) throw new Error('No Ethereum wallet connected');

    const tradeSignature = await provider.request({
      method: 'eth_signTypedData_v4',
      params: [accounts[0], JSON.stringify(quote.trade)],
    });
    let approvalSignature: string | undefined;
    if (quote.approval) {
      approvalSignature = (await provider.request({
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
      const storedWallets = safeLocalParse<Array<{ address?: string; encryptedKey?: string; encryptedMnemonic?: string; solanaAddress?: string; accountIndex?: number; importMethod?: string; derivationPath?: string }>>('steinz_wallets', []);
      const activeAddr = safeLocalGet('steinz_active_wallet_address') || address;
      // Match by EVM address (built-in wallets are keyed on it) or by the Solana
      // address when the taker passed in is the Solana side.
      const storedWallet = storedWallets.find(
        (w) => w.address && activeAddr && normalizeAddress(w.address) === normalizeAddress(activeAddr),
      ) ?? storedWallets.find((w) => w.solanaAddress && w.solanaAddress === address);
      if (!storedWallet) {
        throw new Error('No wallet found. Please re-import your wallet to sign transactions.');
      }

      // Shared password acquisition: reuse the session-cached password, else
      // park on the unlock modal. Returns whether it came from cache so the
      // caller only re-caches a freshly entered one.
      const acquirePwd = async (encryptedForModal: string): Promise<{ pwd: string; cached: boolean }> => {
        const cached = getWalletSessionKey();
        if (cached) return { pwd: cached, cached: true };
        const entered = await requestUnlock({
          encryptedKey: encryptedForModal,
          addressShort: storedWallet.address ? `${storedWallet.address.slice(0, 6)}…${storedWallet.address.slice(-4)}` : undefined,
        });
        if (!entered) throw new Error('Wallet session expired. Please unlock your wallet.');
        return { pwd: entered, cached: false };
      };

      // ── Solana built-in signing ────────────────────────────────────────
      // The built-in wallet derives its Solana keypair from the encrypted
      // mnemonic (the EVM hex key is NOT a Solana key). Decrypt, derive, verify
      // the key matches this account, then sign + broadcast the Jupiter tx.
      if (chain === 'solana') {
        if (!quote.swapTransaction) throw new Error('No Solana transaction data received from the quote.');
        if (!storedWallet.encryptedMnemonic || !storedWallet.solanaAddress) {
          throw new Error("This built-in wallet can't sign Solana trades yet. Re-import its seed phrase from the Wallet page.");
        }
        const { pwd, cached } = await acquirePwd(storedWallet.encryptedMnemonic);
        let mnemonic = '';
        try {
          mnemonic = await decryptPrivateKey(storedWallet.encryptedMnemonic, pwd);
        } catch {
          throw new Error('Failed to decrypt wallet: wrong password, or this wallet predates AES-256-GCM (re-import the seed phrase from the Wallet page).');
        }
        if (!cached) setWalletSessionKey(pwd);
        try {
          const [{ Connection, VersionedTransaction }, { deriveSolanaKeypair }] = await Promise.all([
            import('@solana/web3.js'),
            import('@/lib/wallet/derive'),
          ]);
          const keypair = deriveSolanaKeypair(mnemonic, storedWallet.accountIndex ?? 0);
          // Funds-safety: never broadcast if the derived key isn't this account.
          if (keypair.publicKey.toBase58() !== storedWallet.solanaAddress) {
            throw new Error('Derived signing key does not match this account. Aborted for safety.');
          }
          const conn = new Connection(process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? 'https://api.mainnet-beta.solana.com', 'confirmed');
          const tx = VersionedTransaction.deserialize(Buffer.from(quote.swapTransaction, 'base64'));
          tx.sign([keypair]);
          return await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 2 });
        } finally {
          mnemonic = '';
        }
      }

      // ── EVM built-in signing ───────────────────────────────────────────
      if (!quote.transaction) {
        throw new Error('No transaction data to sign. Re-fetch the quote and try again.');
      }

      // #44 — Ledger hardware wallet: sign the swap tx on the device. No
      // encryptedKey exists (the key lives on the Ledger); route to WebHID.
      if (storedWallet.importMethod === 'ledger') {
        const { sendLedgerEvmTx } = await import('@/lib/wallet/ledger');
        return sendLedgerEvmTx({
          path: storedWallet.derivationPath ?? "44'/60'/0'/0/0",
          rpcUrl: CHAIN_RPCS[chain] ?? CHAIN_RPCS.ethereum,
          tx: {
            to: quote.transaction.to,
            data: quote.transaction.data,
            value: quote.transaction.value ? BigInt(quote.transaction.value) : undefined,
          },
        });
      }

      if (!storedWallet.encryptedKey) {
        throw new Error('No wallet keys found. Please re-import your wallet to sign transactions.');
      }

      const { pwd, cached } = await acquirePwd(storedWallet.encryptedKey);

      // Decrypt via the shared AES-256-GCM/PBKDF2 helper — the same format
      // the Wallet page wrote with encryptPrivateKey. The previous bespoke
      // decrypt assumed a legacy iv-separated payload + raw password key,
      // which never matched and broke every built-in swap.
      let pk: string;
      try {
        pk = await decryptPrivateKey(storedWallet.encryptedKey, pwd);
      } catch {
        throw new Error('Failed to decrypt wallet key: wrong password, or this wallet predates AES-256-GCM (re-import the seed phrase from the Wallet page).');
      }

      // Cache a freshly entered password for the session so buys/sells don't
      // re-prompt (they unlock once, then trade until the auto-lock TTL).
      if (!cached) setWalletSessionKey(pwd);

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

        if (useGasless && quote.trade) {
          hash = await broadcastGasless(quote);
        } else if (walletKind === 'ethereum') {
          const provider = await getEvmProvider();
          if (!provider) throw new Error('Connect an EVM wallet (extension or WalletConnect) to sign this swap.');
          if (!quote.transaction) throw new Error('No transaction data received from the quote.');
          const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
          if (!accounts.length) throw new Error('No Ethereum wallet connected');
          const txParams = {
            from: accounts[0],
            to: quote.transaction.to,
            data: quote.transaction.data,
            value: quote.transaction.value,
            gas: quote.transaction.gas,
          };
          setStatus('submitted');
          hash = (await provider.request({ method: 'eth_sendTransaction', params: [txParams] })) as string;
        } else if (walletKind === 'solana') {
          const sol = await getSolanaProvider();
          if (!sol) throw new Error('Connect a Solana wallet (Phantom or WalletConnect) to sign this swap.');
          if (!quote.swapTransaction) throw new Error('No Solana transaction data received from the quote.');
          const { deserializeSolanaTx } = await import('@/lib/wallet/solanaTx');
          const tx = await deserializeSolanaTx(quote.swapTransaction);
          setStatus('submitted');
          const signed = await sol.signAndSendTransaction(tx);
          // Phantom returns { signature }; the WalletConnect/AppKit provider may
          // return a bare signature string — normalize both.
          hash = typeof signed === 'string' ? signed : signed?.signature ?? '';
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
  if (provider === 'metamask') return 'ethereum';
  // An external EVM wallet connected through wagmi/AppKit signs via the
  // 'ethereum' path — whether it's an injected extension (desktop) or a
  // WalletConnect session (mobile/tablet, where window.ethereum is undefined).
  // We must NOT gate this on window.ethereum: a phone WC session has none, and
  // misrouting it to 'builtin' would fail (there's no stored key for an
  // external wallet).
  if (provider !== 'naka') {
    try {
      const cfg = wagmiAdapter?.wagmiConfig;
      if (cfg && getAccount(cfg).isConnected) return 'ethereum';
    } catch {
      /* fall through to the injected check */
    }
    if (typeof window !== 'undefined' && window.ethereum) return 'ethereum';
  }
  return 'builtin';
}
