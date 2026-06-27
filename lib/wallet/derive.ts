/**
 * Multi-chain HD derivation from a single BIP-39 seed.
 *
 * The Naka built-in wallet historically stored ONE address per
 * StoredWallet — always the secp256k1 EVM derivation at
 * m/44'/60'/0'/0/0. Solana receive showed the EVM hex address
 * mislabelled "Receive on Solana", which a tester correctly flagged
 * as a loss-of-funds risk (Audit B3 / P0 #1).
 *
 * Industry parity: Trust Wallet, Phantom, Rabby, Backpack all derive
 * per-chain addresses from one mnemonic per BIP-44 paths:
 *   EVM (secp256k1):  m/44'/60'/0'/0/0
 *   Solana (ed25519): m/44'/501'/0'/0'   ← Phantom-compatible default
 *   Bitcoin (BIP-84): m/84'/0'/0'/0/0    ← P2WPKH bech32 (deferred)
 *
 * Solana shipped here. Bitcoin requires bitcoinjs-lib + tiny-secp256k1
 * which is a much larger dep surface; the Receive panel keeps showing
 * the honest "Bitcoin support is coming" state until it lands.
 */

import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@solana/web3.js';

const SOL_DERIVATION_PATH = "m/44'/501'/0'/0'";

export interface DerivedAddresses {
  // EVM address (already produced upstream by ethers' HDNodeWallet from
  // the same mnemonic). Mirrored here for completeness only — callers
  // continue to use the ethers-derived value as the canonical EVM
  // identifier; we just want one shape that holds every chain's address.
  evm?: string;
  // Solana base58 public key. Phantom-compatible (uses the same path
  // as Phantom's default Account 1).
  solana?: string;
}

/**
 * Validate a BIP-39 mnemonic. Returns true for the standard 12 / 15 /
 * 18 / 21 / 24-word English wordlist phrases. Wraps bip39's validator
 * directly so we don't drift on edge cases.
 */
export function isValidMnemonic(mnemonic: string): boolean {
  try {
    return bip39.validateMnemonic(mnemonic.trim());
  } catch {
    return false;
  }
}

/**
 * Derive the Solana keypair from a BIP-39 mnemonic at Phantom's default
 * path (m/44'/501'/0'/0'). Returns the base58 public key as a string.
 *
 * Throws if the mnemonic is invalid — callers should guard with
 * isValidMnemonic first when they want graceful UX.
 */
export function deriveSolanaPublicKey(mnemonic: string): string {
  const trimmed = mnemonic.trim();
  if (!bip39.validateMnemonic(trimmed)) {
    throw new Error('Invalid BIP-39 mnemonic');
  }
  // bip39 produces a 64-byte seed; ed25519-hd-key takes that as a hex
  // string per its API contract.
  const seedHex = bip39.mnemonicToSeedSync(trimmed).toString('hex');
  const { key } = derivePath(SOL_DERIVATION_PATH, seedHex);
  // Solana's Keypair.fromSeed expects a 32-byte secret; ed25519-hd-key
  // returns exactly that.
  const keypair = Keypair.fromSeed(key);
  return keypair.publicKey.toBase58();
}

/**
 * Derive the full Solana Keypair (for signing transactions) from a BIP-39
 * mnemonic at Phantom's default path. Same derivation as deriveSolanaPublicKey
 * so the signing key matches the displayed address. Throws on invalid mnemonic.
 */
export function deriveSolanaKeypair(mnemonic: string): Keypair {
  const trimmed = mnemonic.trim();
  if (!bip39.validateMnemonic(trimmed)) {
    throw new Error('Invalid BIP-39 mnemonic');
  }
  const seedHex = bip39.mnemonicToSeedSync(trimmed).toString('hex');
  const { key } = derivePath(SOL_DERIVATION_PATH, seedHex);
  return Keypair.fromSeed(key);
}

/**
 * Convenience: derive every supported chain's address in one call.
 * Used at wallet-create / wallet-import time so we can persist the
 * full set on the StoredWallet record.
 *
 * `evmAddress` is passed in (rather than re-derived here) because
 * upstream callers already have it from ethers' HDNodeWallet — passing
 * it through avoids re-deriving secp256k1 in two places.
 */
export function deriveAllFromMnemonic(mnemonic: string, evmAddress?: string): DerivedAddresses {
  const out: DerivedAddresses = {};
  if (evmAddress) out.evm = evmAddress;
  try {
    out.solana = deriveSolanaPublicKey(mnemonic);
  } catch {
    // Mnemonic was invalid for ed25519 derivation — leave solana
    // undefined so the Receive panel can render its honest
    // "no SOL address derived" state instead of a corrupt value.
  }
  return out;
}
