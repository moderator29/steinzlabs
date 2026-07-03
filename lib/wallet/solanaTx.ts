// Jupiter's /swap endpoint returns a base64 VersionedTransaction (v0) unless
// asLegacyTransaction is requested. Every signer in the app deserialized with
// the legacy Transaction.from(), which throws on version-prefixed messages —
// so ALL built-in/Phantom Solana swaps failed at the signing step. This
// helper accepts both encodings; Phantom's signAndSendTransaction and the
// web3.js Connection APIs accept either type.

import type { Transaction, VersionedTransaction } from '@solana/web3.js';

export async function deserializeSolanaTx(
  base64: string,
): Promise<Transaction | VersionedTransaction> {
  const web3 = await import('@solana/web3.js');
  const bytes = Buffer.from(base64, 'base64');
  try {
    return web3.VersionedTransaction.deserialize(bytes);
  } catch {
    return web3.Transaction.from(bytes);
  }
}
