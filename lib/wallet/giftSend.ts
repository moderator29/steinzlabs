'use client';

/**
 * Non-custodial native transfer for The Wire's Gift flow.
 *
 * This is NOT a new signer. It mirrors the AUDITED send path in
 * app/dashboard/wallet-page/page.tsx (SendView.handleSend) and
 * lib/wallet/pendingSigner.ts exactly — same primitives, same funds-safety
 * guards — packaged as a small helper so the GiftSheet stays readable:
 *
 *   - Built-in Naka wallet: decrypt the AES-256-GCM key/mnemonic with the
 *     in-memory session password (or a typed one), sign locally with
 *     ethers.Wallet (EVM) or a derived Solana keypair, broadcast via the
 *     chain RPC. The private key NEVER leaves the browser.
 *   - External wallet: the extension signs (window.ethereum eth_sendTransaction
 *     / window.solana signAndSendTransaction). We never touch its key.
 *
 * A gift is always a REAL on-chain peer-to-peer transfer of the native asset
 * from the sender's own connected wallet to the recipient's wallet. We never
 * hold funds.
 */

import { decryptPrivateKey } from '@/lib/wallet/encryption';
import { getWalletSessionKey } from '@/lib/wallet/walletSession';
import { getBuiltinWalletAddress } from '@/lib/wallet/builtinWallet';
import { addressesEqual } from '@/lib/utils/addressNormalize';

export interface GiftChain {
  /** Canonical id stored in wire_gifts.chain and passed to resolveReceiveAddress. */
  id: 'ethereum' | 'base' | 'bsc' | 'solana';
  name: string;
  symbol: string;
  rpc: string;
  explorerUrl: string;
  explorerName: string;
  /** CoinGecko id for the native asset (real USD quote for amount_usd). */
  nativeCgId: string;
  isEvm: boolean;
  /** EIP-1193 hex chain id — EVM only. */
  evmChainIdHex?: string;
}

// Public RPCs + explorers, matching the wallet page's SendView. These are
// infra constants, not crypto — kept local so the Gift flow doesn't reach
// into the 4.7k-line wallet page module.
export const GIFT_CHAINS: GiftChain[] = [
  {
    id: 'ethereum', name: 'Ethereum', symbol: 'ETH',
    rpc: process.env.NEXT_PUBLIC_ALCHEMY_RPC || 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io', explorerName: 'Etherscan',
    nativeCgId: 'ethereum', isEvm: true, evmChainIdHex: '0x1',
  },
  {
    id: 'base', name: 'Base', symbol: 'ETH',
    rpc: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org', explorerName: 'BaseScan',
    nativeCgId: 'ethereum', isEvm: true, evmChainIdHex: '0x2105',
  },
  {
    id: 'bsc', name: 'BNB Chain', symbol: 'BNB',
    rpc: 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com', explorerName: 'BscScan',
    nativeCgId: 'binancecoin', isEvm: true, evmChainIdHex: '0x38',
  },
  {
    id: 'solana', name: 'Solana', symbol: 'SOL',
    rpc: process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://solscan.io', explorerName: 'SolScan',
    nativeCgId: 'solana', isEvm: false,
  },
];

export function getGiftChain(id: string): GiftChain | undefined {
  return GIFT_CHAINS.find((c) => c.id === id);
}

export type GiftSenderSource = 'builtin' | 'external_evm' | 'external_solana';

export interface ResolvedGiftSender {
  source: GiftSenderSource;
  address: string;
  /** True when a typed wallet password will be required to sign (built-in
   *  wallet with no live session key). */
  needsPassword: boolean;
}

interface StoredBuiltinWallet {
  address?: string;
  encryptedKey?: string;
  encryptedMnemonic?: string;
  solanaAddress?: string;
  accountIndex?: number;
  importMethod?: string;
}

// window.ethereum / window.solana are declared globally in types/globals.d.ts.

function readBuiltinWallets(): StoredBuiltinWallet[] {
  try {
    const raw = localStorage.getItem('steinz_wallets');
    return raw ? (JSON.parse(raw) as StoredBuiltinWallet[]) : [];
  } catch {
    return [];
  }
}

function activeBuiltinWallet(): StoredBuiltinWallet | null {
  const addr = getBuiltinWalletAddress();
  if (!addr) return null;
  const wallets = readBuiltinWallets();
  return wallets.find((w) => w.address && addressesEqual(w.address, addr, 'ethereum')) ?? null;
}

/**
 * Which wallet will pay for this gift on this chain, and its address.
 * Prefers the built-in Naka wallet (the primary non-custodial wallet);
 * falls back to a connected external extension. Returns null when the
 * user has no usable wallet for the chain.
 */
export async function resolveGiftSender(chain: GiftChain): Promise<ResolvedGiftSender | null> {
  if (typeof window === 'undefined') return null;
  const builtin = activeBuiltinWallet();

  if (chain.isEvm) {
    if (builtin?.address && builtin.encryptedKey) {
      return {
        source: 'builtin',
        address: builtin.address,
        needsPassword: getWalletSessionKey() == null,
      };
    }
    // External EVM (MetaMask / injected) — read already-connected accounts
    // without prompting.
    if (window.ethereum) {
      try {
        const accounts = (await window.ethereum.request({ method: 'eth_accounts' })) as string[];
        if (accounts?.length) return { source: 'external_evm', address: accounts[0], needsPassword: false };
      } catch { /* not connected */ }
    }
    return null;
  }

  // Solana
  if (builtin?.solanaAddress && builtin.encryptedMnemonic) {
    return {
      source: 'builtin',
      address: builtin.solanaAddress,
      needsPassword: getWalletSessionKey() == null,
    };
  }
  if (window.solana?.publicKey) {
    return { source: 'external_solana', address: window.solana.publicKey.toString(), needsPassword: false };
  }
  return null;
}

/** Read the sender's native balance (in whole units) for the chain. */
export async function readNativeBalance(chain: GiftChain, address: string): Promise<string> {
  if (chain.isEvm) {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(chain.rpc);
    const bal = await provider.getBalance(address);
    return ethers.formatEther(bal);
  }
  const web3 = await import('@solana/web3.js');
  const conn = new web3.Connection(chain.rpc, 'confirmed');
  const lamports = await conn.getBalance(new web3.PublicKey(address));
  return (lamports / web3.LAMPORTS_PER_SOL).toString();
}

/**
 * Largest amount the sender can gift, reserving network fees. Mirrors the
 * wallet page's SendView.setMax: reserves gas at the Fast rate (130% of the
 * suggested price × 21000) for EVM; on Solana reserves a small rent/fee
 * buffer. Never returns a negative value.
 */
export async function maxSendableNative(chain: GiftChain, address: string): Promise<string> {
  if (chain.isEvm) {
    const { ethers } = await import('ethers');
    const provider = new ethers.JsonRpcProvider(chain.rpc);
    const [balWei, feeData] = await Promise.all([
      provider.getBalance(address),
      provider.getFeeData(),
    ]);
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || BigInt(0);
    const reserved = (gasPrice * BigInt(130)) / BigInt(100) * BigInt(21000);
    const max = balWei > reserved ? balWei - reserved : BigInt(0);
    return ethers.formatEther(max);
  }
  const web3 = await import('@solana/web3.js');
  const conn = new web3.Connection(chain.rpc, 'confirmed');
  const lamports = await conn.getBalance(new web3.PublicKey(address));
  // Reserve ~0.001 SOL for fee + rent-exempt headroom.
  const reserve = Math.round(0.001 * web3.LAMPORTS_PER_SOL);
  const max = Math.max(0, lamports - reserve);
  return (max / web3.LAMPORTS_PER_SOL).toString();
}

export interface SendGiftParams {
  chain: GiftChain;
  to: string;
  /** Amount in whole native units (e.g. "0.05"). */
  amount: string;
  /** Wallet password — required for a built-in wallet with no live session. */
  password?: string;
}

export interface SendGiftResult {
  txHash: string;
  senderAddress: string;
  source: GiftSenderSource;
}

/**
 * Broadcast the native gift transfer. Throws honest errors:
 *   - "No connected wallet …"      — nothing to send from
 *   - "Enter your wallet password" — built-in wallet locked
 *   - "Wrong wallet password."     — decrypt failed
 *   - insufficient / user-rejected — surfaced from the chain / extension
 */
export async function sendNativeGift(params: SendGiftParams): Promise<SendGiftResult> {
  const { chain, to, amount } = params;
  const amt = parseFloat(amount);
  if (!(amt > 0)) throw new Error('Enter an amount greater than zero.');
  if (!to) throw new Error('This user has not set a receive wallet on this chain yet.');

  const sender = await resolveGiftSender(chain);
  if (!sender) throw new Error('No connected wallet found for this chain. Open your wallet and try again.');

  // ── Built-in EVM ─────────────────────────────────────────────────────
  if (sender.source === 'builtin' && chain.isEvm) {
    const wallet = activeBuiltinWallet();
    if (!wallet?.encryptedKey) throw new Error('Built-in wallet has no stored key.');
    const pwd = getWalletSessionKey() ?? params.password;
    if (!pwd) throw new Error('Enter your wallet password.');
    const { ethers } = await import('ethers');
    let pk = '';
    try {
      pk = await decryptPrivateKey(wallet.encryptedKey, pwd);
    } catch {
      throw new Error('Wrong wallet password.');
    }
    try {
      const provider = new ethers.JsonRpcProvider(chain.rpc);
      const signer = new ethers.Wallet(pk, provider);
      pk = '';
      // Funds-safety: the signing key must be the wallet we display.
      if (!addressesEqual(signer.address, wallet.address ?? '', 'ethereum')) {
        throw new Error('Signing key does not match this wallet. Aborted for safety.');
      }
      const feeData = await provider.getFeeData();
      const txReq: Record<string, unknown> = {
        to,
        value: ethers.parseEther(amount),
        gasLimit: BigInt(21000),
      };
      if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
        txReq.maxFeePerGas = feeData.maxFeePerGas;
        txReq.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
      } else if (feeData.gasPrice) {
        txReq.gasPrice = feeData.gasPrice;
      }
      const tx = await signer.sendTransaction(txReq);
      return { txHash: tx.hash, senderAddress: wallet.address!, source: 'builtin' };
    } finally {
      pk = '';
    }
  }

  // ── Built-in Solana ──────────────────────────────────────────────────
  if (sender.source === 'builtin' && !chain.isEvm) {
    const wallet = activeBuiltinWallet();
    if (!wallet?.encryptedMnemonic) {
      throw new Error('Solana gift needs a seed-phrase wallet (this wallet was imported by private key).');
    }
    if (!wallet.solanaAddress) {
      throw new Error('This wallet has no Solana address derived. Re-import its seed phrase from the Wallet page.');
    }
    const pwd = getWalletSessionKey() ?? params.password;
    if (!pwd) throw new Error('Enter your wallet password.');
    let mnemonic = '';
    try {
      mnemonic = await decryptPrivateKey(wallet.encryptedMnemonic, pwd);
    } catch {
      throw new Error('Wrong wallet password.');
    }
    try {
      const web3 = await import('@solana/web3.js');
      const { deriveSolanaKeypair } = await import('@/lib/wallet/derive');
      const keypair = deriveSolanaKeypair(mnemonic, wallet.accountIndex ?? 0);
      // Funds-safety: derived key must match the account we send from.
      if (keypair.publicKey.toBase58() !== wallet.solanaAddress) {
        throw new Error('Derived signing key does not match this account. Aborted for safety.');
      }
      const conn = new web3.Connection(chain.rpc, 'confirmed');
      const lamports = Math.round(amt * web3.LAMPORTS_PER_SOL);
      const tx = new web3.Transaction().add(
        web3.SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new web3.PublicKey(to),
          lamports,
        }),
      );
      const sig = await web3.sendAndConfirmTransaction(conn, tx, [keypair], { commitment: 'confirmed' });
      return { txHash: sig, senderAddress: wallet.solanaAddress, source: 'builtin' };
    } finally {
      mnemonic = '';
    }
  }

  // ── External EVM (extension signs) ───────────────────────────────────
  if (sender.source === 'external_evm') {
    if (!window.ethereum) throw new Error('No EVM wallet detected.');
    const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
    if (!accounts?.length) throw new Error('No EVM wallet account connected.');
    const from = accounts[0];
    // Ensure the extension is on the right network before sending.
    if (chain.evmChainIdHex) {
      const current = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
      if (current?.toLowerCase() !== chain.evmChainIdHex.toLowerCase()) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chain.evmChainIdHex }],
          });
        } catch {
          throw new Error(`Switch your wallet to ${chain.name} and try again.`);
        }
      }
    }
    const { ethers } = await import('ethers');
    const valueHex = ethers.toBeHex(ethers.parseEther(amount));
    const hash = (await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{ from, to, value: valueHex }],
    })) as string;
    if (!hash) throw new Error('Wallet did not return a transaction hash.');
    return { txHash: hash, senderAddress: from, source: 'external_evm' };
  }

  // ── External Solana (Phantom signs) ──────────────────────────────────
  if (sender.source === 'external_solana') {
    if (!window.solana) throw new Error('No Solana wallet detected.');
    const pub = window.solana.publicKey ?? (await window.solana.connect()).publicKey;
    const from = pub.toString();
    const web3 = await import('@solana/web3.js');
    const conn = new web3.Connection(chain.rpc, 'confirmed');
    const lamports = Math.round(amt * web3.LAMPORTS_PER_SOL);
    const { blockhash } = await conn.getLatestBlockhash('confirmed');
    const tx = new web3.Transaction({ feePayer: new web3.PublicKey(from), recentBlockhash: blockhash }).add(
      web3.SystemProgram.transfer({
        fromPubkey: new web3.PublicKey(from),
        toPubkey: new web3.PublicKey(to),
        lamports,
      }),
    );
    const { signature } = await window.solana.signAndSendTransaction(tx);
    return { txHash: signature, senderAddress: from, source: 'external_solana' };
  }

  throw new Error('Unsupported wallet source.');
}
