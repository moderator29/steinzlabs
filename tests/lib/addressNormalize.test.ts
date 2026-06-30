/**
 * Unit tests for lib/utils/addressNormalize — the canonical cross-chain address
 * comparison used on every money path. The critical invariant: EVM addresses are
 * case-insensitive (lowercased), Solana base58 addresses are CASE-SENSITIVE
 * (preserved) — lower-casing a Solana address silently breaks lookups, copy
 * targeting, and signature checks. node:test runner, no extra deps.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isEvmChain, isEvmAddress, isSolanaAddress, normalizeAddress, addressesEqual,
} from '../../lib/utils/addressNormalize';

const EVM = '0xAbC0000000000000000000000000000000000123';
const SOL = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

describe('isEvmChain', () => {
  it('recognizes EVM chain slugs case-insensitively', () => {
    for (const c of ['ethereum', 'Ethereum', 'BASE', 'bsc', 'arbitrum', 'optimism', 'polygon']) {
      assert.equal(isEvmChain(c), true, c);
    }
  });
  it('rejects non-EVM / missing chains', () => {
    for (const c of ['solana', 'ton', 'bitcoin', undefined, null, '']) {
      assert.equal(isEvmChain(c as string), false, String(c));
    }
  });
});

describe('address shape detection', () => {
  it('classifies EVM addresses', () => {
    assert.equal(isEvmAddress(EVM), true);
    assert.equal(isEvmAddress(SOL), false);
  });
  it('classifies Solana addresses (and excludes EVM-shaped)', () => {
    assert.equal(isSolanaAddress(SOL), true);
    assert.equal(isSolanaAddress(EVM), false);
  });
});

describe('normalizeAddress', () => {
  it('lowercases EVM addresses (with explicit chain)', () => {
    assert.equal(normalizeAddress(EVM, 'ethereum'), EVM.toLowerCase());
  });
  it('lowercases EVM addresses by shape when chain is unknown', () => {
    assert.equal(normalizeAddress(EVM), EVM.toLowerCase());
  });
  it('PRESERVES Solana address case', () => {
    assert.equal(normalizeAddress(SOL, 'solana'), SOL);
    assert.notEqual(normalizeAddress(SOL, 'solana'), SOL.toLowerCase());
  });
  it('trims whitespace', () => {
    assert.equal(normalizeAddress(`  ${SOL}  `, 'solana'), SOL);
  });
  it('returns empty string for empty/non-string input', () => {
    assert.equal(normalizeAddress('', 'ethereum'), '');
    assert.equal(normalizeAddress('   ', 'ethereum'), '');
    // @ts-expect-error — guarding runtime misuse
    assert.equal(normalizeAddress(null), '');
  });
});

describe('addressesEqual', () => {
  it('treats EVM addresses as equal across case', () => {
    assert.equal(addressesEqual(EVM, EVM.toLowerCase(), 'ethereum'), true);
    assert.equal(addressesEqual(EVM, EVM.toUpperCase().replace('0X', '0x'), 'ethereum'), true);
  });
  it('treats Solana addresses differing only by case as NOT equal', () => {
    assert.equal(addressesEqual(SOL, SOL.toLowerCase(), 'solana'), false);
  });
  it('matches identical Solana addresses', () => {
    assert.equal(addressesEqual(SOL, SOL, 'solana'), true);
  });
  it('returns false when either address is empty', () => {
    assert.equal(addressesEqual('', EVM, 'ethereum'), false);
    assert.equal(addressesEqual(EVM, '', 'ethereum'), false);
  });
});
