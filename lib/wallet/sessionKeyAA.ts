/**
 * ZeroDev v5 AA session keys (#41) — true background execution.
 *
 * The platform stays non-custodial for MAIN funds: the user's main Naka EOA
 * is only ever the *owner* (sudo validator) of a ZeroDev kernel smart account.
 * It signs a one-time approval granting a separate, limited SESSION key the
 * right to act on that kernel account, bounded ON-CHAIN by:
 *   • a timestamp policy  → the grant expires automatically
 *   • a rate-limit policy → at most N trades per 24h
 * The rate policy bounds trade *count*, not notional, so the executor adds a
 * software daily-USD cap (#46) on top — see sessionKeyExecutor. A stricter
 * on-chain call policy (restrict the session key to ERC20.approve + the 0x
 * AllowanceHolder) is the next hardening step but needs testnet validation
 * before it can safely replace sudo on a live snipe path.
 * The session key's private key is the only thing held server-side (encrypted),
 * so the background sniper cron can broadcast capped, expiring, revocable buys
 * while the user's tab is closed — WITHOUT ever holding the main wallet key.
 * Funds at risk are limited to whatever the user funds the kernel account with
 * (their snipe budget), never the main wallet.
 *
 * Isomorphic: buildSessionKeyApproval runs in the browser (owner signs);
 * executeSessionKeyTx runs server-side (cron). Both use the same SDK.
 *
 * Verified against @zerodev/sdk 5.5, @zerodev/permissions 5.6,
 * @zerodev/ecdsa-validator 5.4 (KERNEL_V3_1, EntryPoint 0.7).
 *
 * Env (owner-provisioned ZeroDev project): a per-chain ZeroDev RPC (bundler +
 * optional paymaster). Without it, the feature is dormant — getZeroDevRpc
 * returns null and callers fall back to the manual/one-tap path.
 */

import {
  type Address,
  type Hex,
  type Hash,
  createPublicClient,
  http,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import {
  mainnet, base, arbitrum, optimism, polygon, bsc, avalanche, type Chain,
} from 'viem/chains';
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  addressToEmptyAccount,
} from '@zerodev/sdk';
import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import {
  toPermissionValidator,
  serializePermissionAccount,
  deserializePermissionAccount,
} from '@zerodev/permissions';
import { toECDSASigner } from '@zerodev/permissions/signers';
import { toSudoPolicy, toTimestampPolicy, toRateLimitPolicy } from '@zerodev/permissions/policies';

const ENTRY_POINT = getEntryPoint('0.7');
const KERNEL_VERSION = KERNEL_V3_1;

/** Our internal chain slug → viem chain. EVM only (AA is EVM-only). */
const CHAINS: Record<string, Chain> = {
  ethereum: mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
  bsc,
  avalanche,
};

export function aaChainFor(slug: string): Chain | null {
  return CHAINS[slug.toLowerCase()] ?? null;
}

/**
 * Per-chain ZeroDev RPC (bundler + paymaster live on the same URL).
 * Resolution order:
 *   1. explicit ZERODEV_RPC_<CHAIN> / ZERODEV_RPC override, else
 *   2. construct ZeroDev's v3 meta-RPC from NEXT_PUBLIC_ZERODEV_PROJECT_ID —
 *      so the owner only needs the project id set (the URL is derivable):
 *      https://rpc.zerodev.app/api/v3/<projectId>/chain/<chainId>
 * Returns null when neither is configured → feature stays dormant.
 */
export function getZeroDevRpc(slug: string): string | null {
  const explicit = process.env[`ZERODEV_RPC_${slug.toUpperCase()}`] || process.env.ZERODEV_RPC;
  if (explicit) return explicit;
  const projectId = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID;
  const chain = aaChainFor(slug);
  if (projectId && chain) {
    return `https://rpc.zerodev.app/api/v3/${projectId}/chain/${chain.id}`;
  }
  return null;
}

// Public read RPCs — the kernel address derives deterministically from the
// validators + version for a given CHAIN, independent of the RPC URL, so the
// browser (approval step) and the server (execute step) reach the same address
// even when they use different endpoints. These are public, so the client path
// works without exposing the ZeroDev bundler URL to the browser.
const PUBLIC_RPCS: Record<string, string> = {
  ethereum: 'https://eth.llamarpc.com',
  base: 'https://mainnet.base.org',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io',
  polygon: 'https://polygon-rpc.com',
  bsc: 'https://bsc-dataseed.binance.org',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
};

/** A plain RPC for read calls (kernel address derivation). Server env first,
 *  then a public endpoint so the browser approval step works without secrets. */
function getReadRpc(slug: string): string | null {
  const key = `RPC_URL_${slug.toUpperCase()}`;
  return process.env[key] || PUBLIC_RPCS[slug.toLowerCase()] || getZeroDevRpc(slug);
}

export interface SessionKeyScope {
  /** Unix seconds the grant is valid until (on-chain enforced). */
  validUntil: number;
  /** Max trades per rolling 24h (on-chain enforced). */
  maxTradesPerDay: number;
}

/**
 * OWNER step (browser). Build the kernel account from the owner EOA + an empty
 * session signer with on-chain policies, and serialize the approval. The
 * returned approval + kernel address are stored server-side; the session
 * private key (generated separately, server-side) never appears here.
 */
export async function buildSessionKeyApproval(params: {
  ownerPrivateKey: Hex;
  sessionAddress: Address;
  chainSlug: string;
  scope: SessionKeyScope;
}): Promise<{ approval: string; kernelAddress: Address }> {
  const chain = aaChainFor(params.chainSlug);
  const rpc = getReadRpc(params.chainSlug);
  if (!chain || !rpc) throw new Error(`AA session keys not available on ${params.chainSlug}`);

  const publicClient = createPublicClient({ chain, transport: http(rpc) });
  const ownerSigner = privateKeyToAccount(params.ownerPrivateKey);

  const sudoValidator = await signerToEcdsaValidator(publicClient, {
    signer: ownerSigner,
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
  });

  // The session key is represented by an *empty* account here — the owner only
  // authorizes its address; the private key lives server-side.
  const emptySessionSigner = await toECDSASigner({
    signer: addressToEmptyAccount(params.sessionAddress),
  });

  const permissionPlugin = await toPermissionValidator(publicClient, {
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    signer: emptySessionSigner,
    policies: [
      // sudo grants the action; the constraints below bound it on-chain.
      toSudoPolicy({}),
      toTimestampPolicy({ validUntil: params.scope.validUntil }),
      toRateLimitPolicy({ count: params.scope.maxTradesPerDay, interval: 86_400 }),
    ],
  });

  const account = await createKernelAccount(publicClient, {
    entryPoint: ENTRY_POINT,
    kernelVersion: KERNEL_VERSION,
    plugins: { sudo: sudoValidator, regular: permissionPlugin },
  });

  const approval = await serializePermissionAccount(account);
  return { approval, kernelAddress: account.address };
}

/**
 * Read an ERC-20 balance for an owner on a chain via the public/read RPC
 * (audit #47 M3). Used to bound AA sells to what the kernel actually holds so a
 * corrupted/inflated DB amount can't make the session key over-approve/sell.
 * Returns null when the chain/RPC isn't available (caller then skips the cap).
 */
export async function getErc20Balance(
  chainSlug: string,
  owner: Address,
  token: Address,
): Promise<bigint | null> {
  const chain = aaChainFor(chainSlug);
  const rpc = getReadRpc(chainSlug);
  if (!chain || !rpc) return null;
  try {
    const publicClient = createPublicClient({ chain, transport: http(rpc) });
    const bal = await publicClient.readContract({
      address: token,
      abi: [{
        type: 'function', name: 'balanceOf', stateMutability: 'view',
        inputs: [{ name: 'a', type: 'address' }], outputs: [{ name: '', type: 'uint256' }],
      }],
      functionName: 'balanceOf',
      args: [owner],
    });
    return bal as bigint;
  } catch {
    return null;
  }
}

/** Generate a fresh session keypair (server-side). */
export function generateSessionKey(): { privateKey: Hex; address: Address } {
  const privateKey = generatePrivateKey();
  return { privateKey, address: privateKeyToAccount(privateKey).address };
}

/**
 * SERVER step (cron). Deserialize the owner-approved kernel account with the
 * real session signer and broadcast the calls as a sponsored/self-paid
 * userOperation. Returns the on-chain tx hash.
 */
export async function executeSessionKeyTx(params: {
  sessionPrivateKey: Hex;
  approval: string;
  chainSlug: string;
  calls: { to: Address; value?: bigint; data: Hex }[];
}): Promise<Hash> {
  const chain = aaChainFor(params.chainSlug);
  const zerodevRpc = getZeroDevRpc(params.chainSlug);
  if (!chain || !zerodevRpc) throw new Error(`AA execution not configured for ${params.chainSlug}`);

  const publicClient = createPublicClient({ chain, transport: http(getReadRpc(params.chainSlug)!) });
  const sessionSigner = await toECDSASigner({
    signer: privateKeyToAccount(params.sessionPrivateKey),
  });

  const account = await deserializePermissionAccount(
    publicClient,
    ENTRY_POINT,
    KERNEL_VERSION,
    params.approval,
    sessionSigner,
  );

  // Optional gas sponsorship: when the ZeroDev project has a paymaster, gas is
  // sponsored; otherwise the kernel account pays from its own ETH balance.
  const paymasterClient = createZeroDevPaymasterClient({ chain, transport: http(zerodevRpc) });

  const kernelClient = createKernelAccountClient({
    account,
    chain,
    bundlerTransport: http(zerodevRpc),
    client: publicClient,
    paymaster: {
      getPaymasterData: (userOperation) =>
        paymasterClient.sponsorUserOperation({ userOperation }),
    },
  });

  const calls = params.calls.map((c) => ({ to: c.to, value: c.value ?? BigInt(0), data: c.data }));
  const userOpHash = await kernelClient.sendUserOperation({ calls });
  const receipt = await kernelClient.waitForUserOperationReceipt({ hash: userOpHash });
  return receipt.receipt.transactionHash;
}
