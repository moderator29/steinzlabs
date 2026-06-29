/**
 * Unit tests for lib/trading/sessionKeyScope — the single authorization gate
 * every 24/7 auto-copy sign must pass (EVM and Solana). Pure, no I/O.
 * node:test runner, no extra deps.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkSessionScope, type SessionKeyRow } from '../../lib/trading/sessionKeyScope';

const NOW = new Date('2026-06-28T12:00:00Z');

function key(overrides: Partial<SessionKeyRow> = {}): SessionKeyRow {
  return {
    id: 'k1',
    chain: 'ethereum',
    max_per_trade_usd: 100,
    daily_cap_usd: 500,
    allowed_tokens: null,
    expires_at: '2026-12-31T00:00:00Z',
    revoked_at: null,
    ...overrides,
  };
}

const EVM_TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

describe('checkSessionScope — authorization', () => {
  it('authorizes a trade within all limits', () => {
    const v = checkSessionScope(key(), { chain: 'ethereum', tokenAddress: EVM_TOKEN, amountUsd: 50 }, 0, NOW);
    assert.deepEqual(v, { ok: true });
  });

  it('rejects a revoked key', () => {
    const v = checkSessionScope(key({ revoked_at: '2026-06-01T00:00:00Z' }), { chain: 'ethereum', tokenAddress: EVM_TOKEN, amountUsd: 10 }, 0, NOW);
    assert.equal(v.ok, false);
  });

  it('rejects an expired key', () => {
    const v = checkSessionScope(key({ expires_at: '2026-06-01T00:00:00Z' }), { chain: 'ethereum', tokenAddress: EVM_TOKEN, amountUsd: 10 }, 0, NOW);
    assert.equal(v.ok, false);
  });

  it('rejects a chain outside scope', () => {
    const v = checkSessionScope(key({ chain: 'ethereum' }), { chain: 'base', tokenAddress: EVM_TOKEN, amountUsd: 10 }, 0, NOW);
    assert.equal(v.ok, false);
  });

  it('matches chain case-insensitively (slug, not address)', () => {
    const v = checkSessionScope(key({ chain: 'Ethereum' }), { chain: 'ethereum', tokenAddress: EVM_TOKEN, amountUsd: 10 }, 0, NOW);
    assert.equal(v.ok, true);
  });
});

describe('checkSessionScope — amount + caps', () => {
  for (const bad of [0, -5, NaN, Infinity]) {
    it(`rejects non-positive/non-finite amount ${bad}`, () => {
      const v = checkSessionScope(key(), { chain: 'ethereum', tokenAddress: EVM_TOKEN, amountUsd: bad }, 0, NOW);
      assert.equal(v.ok, false);
    });
  }

  it('rejects when amount exceeds max per trade', () => {
    const v = checkSessionScope(key({ max_per_trade_usd: 100 }), { chain: 'ethereum', tokenAddress: EVM_TOKEN, amountUsd: 100.01 }, 0, NOW);
    assert.equal(v.ok, false);
  });

  it('allows an amount exactly at max per trade', () => {
    const v = checkSessionScope(key({ max_per_trade_usd: 100 }), { chain: 'ethereum', tokenAddress: EVM_TOKEN, amountUsd: 100 }, 0, NOW);
    assert.equal(v.ok, true);
  });

  it('rejects when spentToday + amount would breach daily cap', () => {
    const v = checkSessionScope(key({ daily_cap_usd: 500 }), { chain: 'ethereum', tokenAddress: EVM_TOKEN, amountUsd: 60 }, 450, NOW);
    assert.equal(v.ok, false);
  });

  it('allows when spentToday + amount equals the daily cap exactly', () => {
    const v = checkSessionScope(key({ daily_cap_usd: 500 }), { chain: 'ethereum', tokenAddress: EVM_TOKEN, amountUsd: 50 }, 450, NOW);
    assert.equal(v.ok, true);
  });
});

describe('checkSessionScope — token allowlist', () => {
  it('allows any token when allowlist is null/empty', () => {
    assert.equal(checkSessionScope(key({ allowed_tokens: null }), { chain: 'ethereum', tokenAddress: EVM_TOKEN, amountUsd: 10 }, 0, NOW).ok, true);
    assert.equal(checkSessionScope(key({ allowed_tokens: [] }), { chain: 'ethereum', tokenAddress: EVM_TOKEN, amountUsd: 10 }, 0, NOW).ok, true);
  });

  it('allows a token on the allowlist (EVM case-insensitive)', () => {
    const v = checkSessionScope(key({ allowed_tokens: [EVM_TOKEN.toLowerCase()] }), { chain: 'ethereum', tokenAddress: EVM_TOKEN.toUpperCase().replace('0X', '0x'), amountUsd: 10 }, 0, NOW);
    assert.equal(v.ok, true);
  });

  it('rejects a token not on the allowlist', () => {
    const v = checkSessionScope(key({ allowed_tokens: ['0x0000000000000000000000000000000000000001'] }), { chain: 'ethereum', tokenAddress: EVM_TOKEN, amountUsd: 10 }, 0, NOW);
    assert.equal(v.ok, false);
  });

  it('treats Solana allowlist entries as CASE-SENSITIVE (base58)', () => {
    const mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const sol = (t: string) => key({ chain: 'solana', allowed_tokens: [mint] });
    // exact base58 match → ok
    assert.equal(checkSessionScope(sol(mint), { chain: 'solana', tokenAddress: mint, amountUsd: 10 }, 0, NOW).ok, true);
    // case-mangled mint must NOT match (lower-casing a Solana address is a bug)
    assert.equal(checkSessionScope(sol(mint), { chain: 'solana', tokenAddress: mint.toLowerCase(), amountUsd: 10 }, 0, NOW).ok, false);
  });
});
