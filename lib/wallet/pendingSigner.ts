"use client";

import { getWalletSessionKey } from "./walletSession";
import { addressesEqual } from "@/lib/utils/addressNormalize";

/**
 * Inline signer for pending trades. Called from the PendingTradesBanner when
 * the user clicks Confirm — the trade is signed and broadcast from this
 * browser using the same wallet source that created the original order. No
 * page navigation required. The implementation mirrors /app/dashboard/swap
 * signing logic so behavior is identical.
 *
 * Non-custodial invariant: private keys never leave the browser. For builtin
 * wallets we decrypt AES-GCM with the in-memory session password. For
 * MetaMask / Phantom the wallet extension handles signing.
 */

export type InlineWalletSource = "external_evm" | "external_solana" | "builtin";

export interface PendingTradeForSigning {
  id: string;
  chain: string;
  wallet_source: InlineWalletSource;
  from_token_address: string;
  to_token_address: string;
  amount_in: string;
}

export interface InlineSignResult {
  txHash: string;
  clientReportedAmountOut?: string;
  clientReportedPrice?: number;
}

interface EvmTx {
  to: string;
  data: string;
  value?: string;
  gas?: string;
}

interface ZeroxQuote {
  transaction?: EvmTx;
  buyAmount?: string;
  price?: string;
}

interface PrepareResponseEvm {
  chain: string;
  quote: ZeroxQuote;
}

interface PrepareResponseSolana {
  chain: "solana";
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  slippageBps: number;
}

interface StoredBuiltinWallet {
  address?: string;
  encryptedKey?: string;
  iv?: string;
}

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

interface SolanaProvider {
  signAndSendTransaction: (tx: unknown) => Promise<{ signature: string }>;
}

type WindowWithWallets = typeof window & {
  ethereum?: EthereumProvider;
  solana?: SolanaProvider;
};

async function prepare(
  pendingId: string,
  taker: string,
): Promise<PrepareResponseEvm | PrepareResponseSolana> {
  const res = await fetch(`/api/trading/pending-trades/${pendingId}/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taker }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Prepare failed (${res.status})`);
  }
  return (await res.json()) as PrepareResponseEvm | PrepareResponseSolana;
}

async function signExternalEvm(trade: PendingTradeForSigning): Promise<InlineSignResult> {
  const win = window as WindowWithWallets;
  if (!win.ethereum) throw new Error("MetaMask (or compatible EVM wallet) not detected");
  const accounts = (await win.ethereum.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts.length) throw new Error("No EVM wallet account connected");
  const taker = accounts[0];

  const prep = (await prepare(trade.id, taker)) as PrepareResponseEvm;
  const tx = prep.quote.transaction;
  if (!tx) throw new Error("Prepare returned no transaction");

  const txParams = {
    from: taker,
    to: tx.to,
    data: tx.data,
    value: tx.value,
    gas: tx.gas,
  };
  const hash = (await win.ethereum.request({
    method: "eth_sendTransaction",
    params: [txParams],
  })) as string;
  if (!hash) throw new Error("Wallet did not return a tx hash");
  return {
    txHash: hash,
    clientReportedAmountOut: prep.quote.buyAmount,
    clientReportedPrice: prep.quote.price ? Number(prep.quote.price) : undefined,
  };
}

async function signExternalSolana(trade: PendingTradeForSigning): Promise<InlineSignResult> {
  const win = window as WindowWithWallets;
  if (!win.solana) throw new Error("Phantom (or compatible Solana wallet) not detected");

  const pk = localStorage.getItem("steinz_solana_pubkey");
  const taker = pk ?? "phantom";
  const prep = (await prepare(trade.id, taker)) as PrepareResponseSolana;

  // Request a swap transaction from the server aggregator for Solana.
  const qs = new URLSearchParams({
    chain: "solana",
    sellToken: prep.sellToken,
    buyToken: prep.buyToken,
    sellAmount: prep.sellAmount,
    taker: pk ?? "",
  });
  const quoteRes = await fetch(`/api/swap/quote?${qs.toString()}`);
  if (!quoteRes.ok) {
    const err = (await quoteRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? "Solana quote failed");
  }
  const swapData = (await quoteRes.json()) as { swapTransaction?: string };
  if (!swapData.swapTransaction) throw new Error("No Solana transaction returned");

  const { Transaction } = await import("@solana/web3.js");
  const txBytes = Buffer.from(swapData.swapTransaction, "base64");
  const sTx = Transaction.from(txBytes);
  const signed = await win.solana.signAndSendTransaction(sTx);
  return { txHash: signed.signature };
}

async function decryptBuiltinKey(pwd: string, wallet: StoredBuiltinWallet): Promise<string> {
  if (!wallet.encryptedKey) throw new Error("Built-in wallet has no stored key");
  if (!wallet.iv) {
    // Legacy XOR fallback removed — XOR with a password keystream is
    // cryptographically broken (known-plaintext recovery) and was a
    // §1 audit Critical. Affected users must re-import the seed phrase
    // to upgrade the at-rest format to AES-256-GCM.
    throw new Error(
      "This wallet uses an outdated encryption format. Please re-import the seed phrase from the Wallet page to upgrade to AES-256-GCM.",
    );
  }
  const keyMaterial = new TextEncoder().encode(pwd.padEnd(32).slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey("raw", keyMaterial, "AES-GCM", false, [
    "decrypt",
  ]);
  const iv = Uint8Array.from(atob(wallet.iv), (c) => c.charCodeAt(0));
  const encrypted = Uint8Array.from(atob(wallet.encryptedKey), (c) => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, encrypted);
  return new TextDecoder().decode(decrypted);
}

const BUILTIN_RPC: Record<string, string> = {
  ethereum: "https://eth.llamarpc.com",
  base: "https://mainnet.base.org",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  polygon: "https://polygon-rpc.com",
  bsc: "https://bsc-dataseed.binance.org",
  avalanche: "https://api.avax.network/ext/bc/C/rpc",
  optimism: "https://mainnet.optimism.io",
};

async function signBuiltin(trade: PendingTradeForSigning): Promise<InlineSignResult> {
  const pwd = getWalletSessionKey();
  if (!pwd) {
    throw new Error(
      "Built-in wallet locked. Unlock it from the Wallet page and try again.",
    );
  }
  const storedJson = localStorage.getItem("steinz_wallets");
  if (!storedJson) throw new Error("No built-in wallet found");
  const wallets = JSON.parse(storedJson) as StoredBuiltinWallet[];
  const activeAddr = localStorage.getItem("steinz_active_wallet_address") ?? "";
  const wallet = wallets.find((w) => w.address && addressesEqual(w.address, activeAddr));
  if (!wallet) throw new Error("Active built-in wallet not found");
  if (!wallet.address) throw new Error("Built-in wallet missing address");

  const pk = await decryptBuiltinKey(pwd, wallet);

  const prep = (await prepare(trade.id, wallet.address)) as PrepareResponseEvm;
  const tx = prep.quote.transaction;
  if (!tx) throw new Error("Prepare returned no transaction");

  const rpcUrl = BUILTIN_RPC[trade.chain.toLowerCase()] ?? BUILTIN_RPC.ethereum;
  const { ethers } = await import("ethers");
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(pk, provider);
  const broadcast = await signer.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value ? BigInt(tx.value) : undefined,
    gasLimit: tx.gas ? BigInt(tx.gas) : undefined,
  });
  return {
    txHash: broadcast.hash,
    clientReportedAmountOut: prep.quote.buyAmount,
    clientReportedPrice: prep.quote.price ? Number(prep.quote.price) : undefined,
  };
}

export async function signPendingTradeInline(
  trade: PendingTradeForSigning,
): Promise<InlineSignResult> {
  if (trade.wallet_source === "external_evm") return signExternalEvm(trade);
  if (trade.wallet_source === "external_solana") return signExternalSolana(trade);
  if (trade.wallet_source === "builtin") return signBuiltin(trade);
  throw new Error(`Unknown wallet source: ${trade.wallet_source}`);
}
