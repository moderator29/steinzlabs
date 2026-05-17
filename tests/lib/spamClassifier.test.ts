/**
 * Unit tests for lib/portfolio/spamClassifier. Uses Node's built-in
 * test runner (node --test) — no vitest / jest dep needed. Run with:
 *
 *   npx tsx --test tests/lib/spamClassifier.test.ts
 *
 * Audit B.19 infra P1 — first sample suite seeding the testing
 * habit. CI config wires `npm run test` to find every *.test.ts in
 * a follow-up branch.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifySpam } from '../../lib/portfolio/spamClassifier';

describe('classifySpam', () => {
  it('flags honeypot as max spam', () => {
    const r = classifySpam({ symbol: 'FOO', isHoneypot: true });
    assert.equal(r.isSpam, true);
    assert.equal(r.score, 1);
    assert.ok(r.reasons.includes('honeypot'));
  });

  it('flags very low GoPlus security score', () => {
    const r = classifySpam({ symbol: 'ABC', securityScore: 10 });
    assert.equal(r.isSpam, true);
    assert.ok(r.reasons.some((s) => s.startsWith('security')));
  });

  it('ignores legitimate tokens with high security score', () => {
    const r = classifySpam({ symbol: 'USDC', securityScore: 95 });
    assert.equal(r.isSpam, false);
    assert.equal(r.reasons.length, 0);
  });

  it('flags airdrop-keyword symbols', () => {
    const r = classifySpam({ symbol: 'CLAIM-AIRDROP.COM' });
    assert.equal(r.isSpam, true);
    assert.ok(r.reasons.includes('promo keyword'));
  });

  it('flags untransferred dust positions', () => {
    const r = classifySpam({ symbol: 'XYZ', balance: 1000, valueUsd: 0.001, neverTransferredOut: true });
    assert.equal(r.isSpam, true);
    assert.ok(r.reasons.includes('untransferred dust'));
  });

  it('does NOT flag legitimate small-balance positions the user has used', () => {
    const r = classifySpam({ symbol: 'XYZ', balance: 1000, valueUsd: 0.001, neverTransferredOut: false });
    assert.equal(r.reasons.includes('untransferred dust'), false);
  });

  it('flags symbols with zero-width chars (homograph spam)', () => {
    const r = classifySpam({ symbol: 'FO​O' });
    assert.equal(r.isSpam, true);
    assert.ok(r.reasons.includes('zero-width chars'));
  });

  it('does NOT flag short clean symbols', () => {
    const r = classifySpam({ symbol: 'ETH' });
    assert.equal(r.isSpam, false);
  });
});
