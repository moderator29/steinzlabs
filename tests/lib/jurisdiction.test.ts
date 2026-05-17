/**
 * Unit tests for lib/compliance/jurisdiction. node:test runner.
 * Audit B.19 infra P1.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyJurisdiction,
  readCountryFromHeaders,
  jurisdictionFromRequest,
} from '../../lib/compliance/jurisdiction';

describe('classifyJurisdiction', () => {
  it('maps OFAC list to blocked', () => {
    for (const c of ['IR', 'KP', 'SY', 'CU', 'RU', 'BY']) {
      assert.equal(classifyJurisdiction(c), 'blocked', `${c} should be blocked`);
    }
  });

  it('maps high-regulation jurisdictions to restricted', () => {
    for (const c of ['US', 'CA', 'GB', 'SG']) {
      assert.equal(classifyJurisdiction(c), 'restricted');
    }
  });

  it('maps common allowed jurisdictions to allowed', () => {
    assert.equal(classifyJurisdiction('DE'), 'allowed');
    assert.equal(classifyJurisdiction('JP'), 'allowed');
    assert.equal(classifyJurisdiction('NG'), 'allowed');
  });

  it('returns unknown for empty / malformed input', () => {
    assert.equal(classifyJurisdiction(''), 'unknown');
    assert.equal(classifyJurisdiction(null), 'unknown');
    assert.equal(classifyJurisdiction(undefined), 'unknown');
    assert.equal(classifyJurisdiction('XX'), 'unknown');
    assert.equal(classifyJurisdiction('USA'), 'unknown');
  });

  it('is case-insensitive', () => {
    assert.equal(classifyJurisdiction('us'), 'restricted');
    assert.equal(classifyJurisdiction('ir'), 'blocked');
  });
});

describe('readCountryFromHeaders', () => {
  it('reads Vercel header', () => {
    const h = new Headers({ 'x-vercel-ip-country': 'DE' });
    assert.equal(readCountryFromHeaders(h), 'DE');
  });

  it('falls back to Cloudflare header', () => {
    const h = new Headers({ 'cf-ipcountry': 'NG' });
    assert.equal(readCountryFromHeaders(h), 'NG');
  });

  it('returns null when neither present', () => {
    assert.equal(readCountryFromHeaders(new Headers()), null);
  });
});

describe('jurisdictionFromRequest', () => {
  it('combines read + classify', () => {
    const h = new Headers({ 'x-vercel-ip-country': 'IR' });
    const result = jurisdictionFromRequest(h);
    assert.equal(result.country, 'IR');
    assert.equal(result.risk, 'blocked');
  });

  it('returns unknown when no header', () => {
    const result = jurisdictionFromRequest(new Headers());
    assert.equal(result.country, null);
    assert.equal(result.risk, 'unknown');
  });
});
