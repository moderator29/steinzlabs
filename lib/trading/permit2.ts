/**
 * Permit2 calldata builder for swap routes. Permit2 (canonical at
 * 0x000000000022D473030F116dDEE9F6B43aC78BA3) lets a user authorize
 * a token transfer with a signed message instead of a separate
 * `approve` tx — halves gas + clicks on every first-time swap of a
 * given token.
 *
 * This module is the pure 'shape the data' layer. The actual signing
 * happens client-side via wagmi's signTypedData; the resulting
 * signature is stitched into the swap calldata by the 0x router.
 *
 * Audit §5.2 trade-exec P1 Permit2.
 */

export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

export interface Permit2Details {
  /** Token being authorized. */
  token: string;
  /** Amount (as a decimal string to avoid JS bigint footguns). */
  amount: string;
  /** Permit expiration (seconds since epoch). Default 30 min from now. */
  expiration: number;
  /** Per-token nonce. Caller fetches from Permit2 contract. */
  nonce: number;
}

export interface Permit2TypedData {
  domain: { name: 'Permit2'; chainId: number; verifyingContract: string };
  types: {
    PermitTransferFrom: Array<{ name: string; type: string }>;
    TokenPermissions: Array<{ name: string; type: string }>;
  };
  primaryType: 'PermitTransferFrom';
  message: {
    permitted: { token: string; amount: string };
    spender: string;
    nonce: number;
    deadline: number;
  };
}

/**
 * Build the EIP-712 typed data payload the wallet will sign. The
 * spender is the 0x exchange-proxy (varies per chain — caller
 * supplies). `deadline` is the only timestamp the signature embeds;
 * Permit2 ignores `expiration` for SignatureTransfer flows.
 */
export function buildPermit2TypedData(
  details: Permit2Details,
  spender: string,
  chainId: number,
  deadlineSeconds: number = Math.floor(Date.now() / 1000) + 1800,
): Permit2TypedData {
  return {
    domain: {
      name: 'Permit2',
      chainId,
      verifyingContract: PERMIT2_ADDRESS,
    },
    types: {
      PermitTransferFrom: [
        { name: 'permitted', type: 'TokenPermissions' },
        { name: 'spender', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
      TokenPermissions: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
    },
    primaryType: 'PermitTransferFrom',
    message: {
      permitted: { token: details.token, amount: details.amount },
      spender,
      nonce: details.nonce,
      deadline: deadlineSeconds,
    },
  };
}

/**
 * Check whether a chain has Permit2 deployed. Permit2 ships on every
 * major EVM chain at the canonical address; this list mirrors what
 * 0x Swap API supports for permit calldata.
 */
const PERMIT2_SUPPORTED: ReadonlySet<number> = new Set([
  1,        // Ethereum
  10,       // Optimism
  56,       // BSC
  137,      // Polygon
  8453,     // Base
  42161,    // Arbitrum
  43114,    // Avalanche
]);

export function isPermit2Supported(chainId: number): boolean {
  return PERMIT2_SUPPORTED.has(chainId);
}
