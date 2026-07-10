'use client';

/**
 * Naka-as-a-wallet (#43): let external dApps connect to the Naka built-in
 * wallet over WalletConnect v2 and have Naka sign their requests — the inverse
 * of the existing "connect MetaMask to Naka" flow.
 *
 * Non-custodial: every signing request is shown to the user and signed in the
 * browser with their decrypted built-in key (password-gated per request); the
 * server is never involved. EVM only.
 *
 * Verified against @reown/walletkit 1.5 + @walletconnect/core/utils 2.23.
 */

import { WalletKit, type IWalletKit } from '@reown/walletkit';
import { Core } from '@walletconnect/core';
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils';

// NOTE: `eth_sign` is deliberately NOT advertised (audit #47 H2). It signs an
// arbitrary 32-byte digest with no human-readable framing — the classic
// blind-signing primitive a malicious dApp uses to get a user to "sign a
// message" that is actually a transaction/approval hash. MetaMask disables it
// by default for the same reason; we don't support it at all.
const EVM_METHODS = [
  'eth_sendTransaction',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
];
const EVM_EVENTS = ['accountsChanged', 'chainChanged'];

/** chainId → public RPC for eth_sendTransaction broadcast. */
const RPC_BY_CHAINID: Record<number, string> = {
  1: 'https://eth.llamarpc.com',
  8453: 'https://mainnet.base.org',
  42161: 'https://arb1.arbitrum.io/rpc',
  10: 'https://mainnet.optimism.io',
  137: 'https://polygon-rpc.com',
  56: 'https://bsc-dataseed.binance.org',
  43114: 'https://api.avax.network/ext/bc/C/rpc',
};

// Audit #47 M5: a poisoned public RPC can manipulate fee/nonce data on the
// broadcast path. Prefer an operator-configured authenticated RPC per chain when
// present (explicit refs so Next inlines the NEXT_PUBLIC values), falling back to
// the public endpoint. The user still confirms to/value/data in the UI.
const RPC_OVERRIDE: Record<number, string | undefined> = {
  1: process.env.NEXT_PUBLIC_RPC_ETHEREUM,
  8453: process.env.NEXT_PUBLIC_RPC_BASE,
  42161: process.env.NEXT_PUBLIC_RPC_ARBITRUM,
  10: process.env.NEXT_PUBLIC_RPC_OPTIMISM,
  137: process.env.NEXT_PUBLIC_RPC_POLYGON,
  56: process.env.NEXT_PUBLIC_RPC_BSC,
  43114: process.env.NEXT_PUBLIC_RPC_AVALANCHE,
};

function rpcForChain(chainId: number): string | undefined {
  return RPC_OVERRIDE[chainId] || RPC_BY_CHAINID[chainId];
}

export const DAPP_SUPPORTED_CHAIN_IDS = Object.keys(RPC_BY_CHAINID).map(Number);

let _kit: IWalletKit | null = null;
let _initPromise: Promise<IWalletKit | null> | null = null;

export function dappConnectConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
}

/** Lazily init a single WalletKit instance. Returns null when no project id. */
export async function getWalletKit(): Promise<IWalletKit | null> {
  if (_kit) return _kit;
  if (_initPromise) return _initPromise;
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  if (!projectId) return null;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nakalabs.xyz';
  _initPromise = (async () => {
    const core = new Core({ projectId });
    _kit = await WalletKit.init({
      core,
      metadata: {
        name: 'Naka Labs',
        description: 'Naka Labs wallet',
        url: origin,
        icons: [`${origin}/logo.png`],
      },
    });
    return _kit;
  })();
  return _initPromise;
}

/** Approve a session proposal, granting the dApp our EVM address on all
 *  supported chains the proposal asks for (intersected by buildApprovedNamespaces). */
export async function approveDappSession(params: {
  proposal: Parameters<typeof buildApprovedNamespaces>[0]['proposal'];
  address: string;
}) {
  const kit = await getWalletKit();
  if (!kit) throw new Error('WalletConnect is not configured on this deployment.');
  const chains = DAPP_SUPPORTED_CHAIN_IDS.map((id) => `eip155:${id}`);
  const approvedNamespaces = buildApprovedNamespaces({
    proposal: params.proposal,
    supportedNamespaces: {
      eip155: {
        chains,
        methods: EVM_METHODS,
        events: EVM_EVENTS,
        accounts: chains.map((c) => `${c}:${params.address}`),
      },
    },
  });
  return kit.approveSession({ id: (params.proposal as { id: number }).id, namespaces: approvedNamespaces });
}

export async function rejectDappSession(id: number) {
  const kit = await getWalletKit();
  if (!kit) return;
  await kit.rejectSession({ id, reason: getSdkError('USER_REJECTED') });
}

/**
 * Sign an EVM session request with the user's decrypted private key and return
 * the JSON-RPC result. Throws on unsupported methods or signing failures.
 */
export async function signEvmRequest(params: {
  method: string;
  requestParams: unknown[];
  chainId: number;
  privateKey: string;
}): Promise<string> {
  const { ethers } = await import('ethers');
  const wallet = new ethers.Wallet(params.privateKey);
  const m = params.method;

  // Audit #47 M4: a malicious/buggy dApp can name a signer address that isn't
  // ours. We only ever hold the active built-in key, so signing a request that
  // targets a different account would mis-attribute the signature. Reject any
  // mismatch up-front (case-insensitive, checksum-normalized).
  const assertSelf = (addr: unknown) => {
    if (typeof addr !== 'string' || !ethers.isAddress(addr)) return;
    if (ethers.getAddress(addr) !== ethers.getAddress(wallet.address)) {
      throw new Error('Requested signer does not match the connected Naka wallet.');
    }
  };

  if (m === 'personal_sign') {
    // params: [message(hex), address]
    assertSelf(params.requestParams[1]);
    const message = params.requestParams[0] as string;
    return wallet.signMessage(ethers.getBytes(message));
  }
  if (m === 'eth_sign') {
    // Blind-signing primitive — rejected outright (audit #47 H2). Not advertised
    // in EVM_METHODS, but reject defensively in case a dApp requests it anyway.
    throw new Error('eth_sign is disabled: it allows blind-signing of arbitrary data.');
  }
  if (m === 'eth_signTypedData' || m === 'eth_signTypedData_v4') {
    // params: [address, typedDataJSON]
    assertSelf(params.requestParams[0]);
    const raw = params.requestParams[1] as string;
    const typed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const types = { ...typed.types };
    delete types.EIP712Domain; // ethers derives this itself
    return wallet.signTypedData(typed.domain, types, typed.message);
  }
  if (m === 'eth_sendTransaction') {
    const rpc = rpcForChain(params.chainId);
    if (!rpc) throw new Error(`Unsupported chain for sending: ${params.chainId}`);
    const provider = new ethers.JsonRpcProvider(rpc);
    const signer = wallet.connect(provider);
    const tx = params.requestParams[0] as { from?: string; to: string; data?: string; value?: string; gas?: string };
    // Don't broadcast a tx the dApp attributed to a different `from` account.
    assertSelf(tx.from);
    const sent = await signer.sendTransaction({
      to: tx.to,
      data: tx.data,
      value: tx.value ? BigInt(tx.value) : undefined,
      gasLimit: tx.gas ? BigInt(tx.gas) : undefined,
    });
    return sent.hash;
  }
  throw new Error(`Unsupported request method: ${m}`);
}

export async function respondDappRequest(params: {
  topic: string;
  id: number;
  result?: string;
  error?: boolean;
}) {
  const kit = await getWalletKit();
  if (!kit) return;
  const response = params.error
    ? { id: params.id, jsonrpc: '2.0' as const, error: getSdkError('USER_REJECTED') }
    : { id: params.id, jsonrpc: '2.0' as const, result: params.result! };
  await kit.respondSessionRequest({ topic: params.topic, response });
}

export async function disconnectDappSession(topic: string) {
  const kit = await getWalletKit();
  if (!kit) return;
  await kit.disconnectSession({ topic, reason: getSdkError('USER_DISCONNECTED') });
}
