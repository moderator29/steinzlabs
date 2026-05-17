/**
 * Unit tests for lib/referral/referralCode. node:test runner, no
 * extra deps. Audit B.19 infra P1.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateReferralCode,
  isValidReferralCode,
  normalizeReferralCode,
} from '../../lib/referral/referralCode';

describe('generateReferralCode', () => {
  it('returns an 8-char Crockford-style code', () => {
    const code = generateReferralCode('user-1');
    assert.equal(code.length, 8);
    assert.match(code, /^[A-Z0-9]+$/);
    assert.doesNotMatch(code, /[0O1IL]/);
  });

  it('is deterministic per user', () => {
    assert.equal(generateReferralCode('alice'), generateReferralCode('alice'));
  });

  it('produces different codes for different users', () => {
    assert.notEqual(generateReferralCode('alice'), generateReferralCode('bob'));
  });

  it('returns empty string for empty userId', () => {
    assert.equal(generateReferralCode(''), '');
  });
});

describe('isValidReferralCode', () => {
  it('accepts a freshly-generated code', () => {
    assert.equal(isValidReferralCode(generateReferralCode('x')), true);
  });

  it('rejects null / undefined / wrong length', () => {
    assert.equal(isValidReferralCode(null), false);
    assert.equal(isValidReferralCode(undefined), false);
    assert.equal(isValidReferralCode('ABC'), false);
    assert.equal(isValidReferralCode('A'.repeat(20)), false);
  });

  it('rejects forbidden characters', () => {
    assert.equal(isValidReferralCode('AAAAAAAO'), false); // contains O
    assert.equal(isValidReferralCode('AAAAAAAA1'), false); // 9 chars + 1
  });
});

describe('normalizeReferralCode', () => {
  it('uppercases + strips dashes/spaces', () => {
    const real = generateReferralCode('user-x');
    const messy = real.toLowerCase().split('').join('-');
    assert.equal(normalizeReferralCode(messy), real);
  });

  it('returns null for invalid input', () => {
    assert.equal(normalizeReferralCode('foo'), null);
    assert.equal(normalizeReferralCode(null), null);
  });
});
