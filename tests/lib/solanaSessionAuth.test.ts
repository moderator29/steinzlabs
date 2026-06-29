/**
 * Unit tests for lib/trading/solanaSessionAuth — the ed25519 authorization gate
 * for Solana session-key provisioning. A forged or tampered signature must be
 * rejected, and a session secret must match its claimed pubkey. node:test.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { Keypair } from '@solana/web3.js';
import {
  buildSolanaAuthMessage, verifySolanaAuthMessage, solanaSecretMatchesAddress, type SolanaAuthScope,
} from '../../lib/trading/solanaSessionAuth';

function scope(over: Partial<SolanaAuthScope> = {}): SolanaAuthScope {
  return {
    sessionAddress: 'SesSioNPubKey1111111111111111111111111111111',
    chain: 'solana',
    maxPerTradeUsd: 100,
    dailyCapUsd: 500,
    allowedTokens: '',
    expiresAt: 1900000000,
    ...over,
  };
}

function sign(message: string, kp: Keypair): string {
  const sig = nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey);
  return bs58.encode(sig);
}

describe('buildSolanaAuthMessage', () => {
  it('is deterministic and includes the scope', () => {
    const m = buildSolanaAuthMessage(scope());
    assert.equal(m, buildSolanaAuthMessage(scope()));
    assert.match(m, /NakaLabs Session Key Authorization/);
    assert.match(m, /Max per trade \(USD\): 100/);
    assert.match(m, /Allowed tokens: any/);
  });
});

describe('verifySolanaAuthMessage', () => {
  it('accepts a valid signature by the main wallet', () => {
    const main = Keypair.generate();
    const msg = buildSolanaAuthMessage(scope());
    assert.equal(verifySolanaAuthMessage(msg, sign(msg, main), main.publicKey.toBase58()), true);
  });

  it('rejects a signature from a DIFFERENT wallet', () => {
    const main = Keypair.generate();
    const attacker = Keypair.generate();
    const msg = buildSolanaAuthMessage(scope());
    assert.equal(verifySolanaAuthMessage(msg, sign(msg, attacker), main.publicKey.toBase58()), false);
  });

  it('rejects a tampered message (scope changed after signing)', () => {
    const main = Keypair.generate();
    const signedMsg = buildSolanaAuthMessage(scope({ maxPerTradeUsd: 100 }));
    const sig = sign(signedMsg, main);
    const tampered = buildSolanaAuthMessage(scope({ maxPerTradeUsd: 99999 }));
    assert.equal(verifySolanaAuthMessage(tampered, sig, main.publicKey.toBase58()), false);
  });

  it('rejects garbage input without throwing', () => {
    assert.equal(verifySolanaAuthMessage('msg', 'not-base58!!', 'also-bad'), false);
  });
});

describe('solanaSecretMatchesAddress', () => {
  it('matches a base58 secret to its pubkey', () => {
    const kp = Keypair.generate();
    const secretB58 = bs58.encode(kp.secretKey);
    assert.equal(solanaSecretMatchesAddress(secretB58, kp.publicKey.toBase58()), true);
  });

  it('matches a JSON-array secret to its pubkey', () => {
    const kp = Keypair.generate();
    const json = JSON.stringify(Array.from(kp.secretKey));
    assert.equal(solanaSecretMatchesAddress(json, kp.publicKey.toBase58()), true);
  });

  it('rejects a secret that does NOT match the claimed address', () => {
    const kp = Keypair.generate();
    const other = Keypair.generate();
    assert.equal(solanaSecretMatchesAddress(bs58.encode(kp.secretKey), other.publicKey.toBase58()), false);
  });

  it('rejects an unparseable secret', () => {
    assert.equal(solanaSecretMatchesAddress('garbage', Keypair.generate().publicKey.toBase58()), false);
  });
});
