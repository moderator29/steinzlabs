'use client';

/**
 * Ledger hardware-wallet support (#42), EVM via WebHID.
 *
 * Fully non-custodial: the private key never leaves the device. We only ever
 * read the address and ask the device to sign a transaction the user confirms
 * on its screen. WebHID is desktop-Chromium only (Chrome/Edge/Brave) over
 * HTTPS; isWebHidSupported() gates the UI so other browsers see an honest
 * "not supported" state.
 *
 * Verified against @ledgerhq/hw-app-eth 7.8 (getAddress, clearSignTransaction)
 * + @ledgerhq/hw-transport-webhid 6.35.
 */

export const DEFAULT_LEDGER_PATH = "44'/60'/0'/0/0";

export function isWebHidSupported(): boolean {
  return typeof navigator !== 'undefined' && 'hid' in navigator;
}

async function openEth(): Promise<{ eth: import('@ledgerhq/hw-app-eth').default; close: () => Promise<void> }> {
  const TransportWebHID = (await import('@ledgerhq/hw-transport-webhid')).default;
  const Eth = (await import('@ledgerhq/hw-app-eth')).default;
  const transport = await TransportWebHID.create();
  const eth = new Eth(transport);
  return { eth, close: () => transport.close().catch(() => {}) };
}

/** Prompt the device + return the address at a derivation path (no on-device confirm). */
export async function connectLedger(path = DEFAULT_LEDGER_PATH): Promise<{ address: string; path: string }> {
  if (!isWebHidSupported()) {
    throw new Error('Hardware wallets need a WebHID browser. Use Chrome, Edge, or Brave on desktop.');
  }
  const { eth, close } = await openEth();
  try {
    const { address } = await eth.getAddress(path, false);
    return { address, path };
  } finally {
    await close();
  }
}

/**
 * Build, sign (on-device), and broadcast an EIP-1559 EVM transaction with a
 * Ledger. One transport session: derive nonce/fees, ask the device to sign,
 * broadcast. The user confirms the exact to/value/data on the Ledger screen.
 * Returns the tx hash. Throws with a user-facing message on rejection/errors.
 */
export async function sendLedgerEvmTx(params: {
  path: string;
  rpcUrl: string;
  tx: { to: string; value?: bigint; data?: string };
}): Promise<string> {
  if (!isWebHidSupported()) {
    throw new Error('Hardware wallets need a WebHID browser. Use Chrome, Edge, or Brave on desktop.');
  }
  const { ethers } = await import('ethers');
  const provider = new ethers.JsonRpcProvider(params.rpcUrl);
  const { eth, close } = await openEth();
  try {
    const { address } = await eth.getAddress(params.path, false);
    const [nonce, feeData, net] = await Promise.all([
      provider.getTransactionCount(address),
      provider.getFeeData(),
      provider.getNetwork(),
    ]);

    const value = params.tx.value ?? BigInt(0);
    const data = params.tx.data ?? '0x';
    const gasLimit = await provider.estimateGas({ to: params.tx.to, value, data, from: address });

    // Build a concrete (already-resolved) EIP-1559 transaction to serialize.
    const unsigned = ethers.Transaction.from({
      to: params.tx.to,
      value,
      data,
      nonce,
      chainId: net.chainId,
      type: 2,
      gasLimit,
      maxFeePerGas: feeData.maxFeePerGas ?? undefined,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
    });
    // clearSignTransaction resolves ERC-20 / known contracts so the device can
    // display human-readable details instead of a raw blob.
    const sig = await eth.clearSignTransaction(
      params.path,
      unsigned.unsignedSerialized.replace(/^0x/, ''),
      { externalPlugins: true, erc20: true, nft: false },
    );
    // EIP-1559 (type 2): the returned v is the yParity (0/1).
    unsigned.signature = ethers.Signature.from({
      r: '0x' + sig.r,
      s: '0x' + sig.s,
      yParity: (parseInt(sig.v, 16) % 2) as 0 | 1,
    });
    const resp = await provider.broadcastTransaction(unsigned.serialized);
    return resp.hash;
  } finally {
    await close();
  }
}
