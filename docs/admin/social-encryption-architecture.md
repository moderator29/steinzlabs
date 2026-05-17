# Social DM Encryption Architecture

End-to-end encryption design for `/dashboard/messages/[peerId]`. Source: `lib/social/encryption.ts`, `lib/social/keyVault.ts`, server routes `/api/social/keypair` + `/api/social/dm/*`.

## Threat model

**Goal:** Even with full read access to the Supabase database, an attacker cannot read message plaintext.

**Out of scope:** active-attacker MITM during initial keypair publication, malicious client extensions, OS-level keyloggers. (Standard limits — Signal has the same.)

## Primitives

We use [libsodium](https://github.com/jedisct1/libsodium.js) — its high-level `crypto_box_*` (asymmetric, X25519+XSalsa20+Poly1305) and `crypto_secretbox_*` (symmetric, XSalsa20+Poly1305) APIs handle nonces, MACs, and key sizes safely.

## Bootstrap (first DM)

1. Client checks `/api/social/keypair` for the user's published key:
   - **Has key**: server returns `{ public_key, encrypted_private_key }`. Client unwraps the private key (see "Private key at rest" below) and caches both on `window.__NAKA_SOCIAL_KEYS__` for the session.
   - **No key**: client generates a fresh `crypto_box_keypair()`. Wraps the private key with the session-derived secret, POSTs `{ public_key, encrypted_private_key }` to the server. Server stores both as TEXT on the user's `profiles` row.

## Private key at rest

The published private key is wrapped before upload using a secret derived from the user's Supabase access token:

```ts
const bytes = enc(accessToken);
const buf = new ArrayBuffer(bytes.byteLength);
new Uint8Array(buf).set(bytes);
const hash = await crypto.subtle.digest('SHA-256', buf);
const wrapSecret = new Uint8Array(hash);

const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
const ct = sodium.crypto_secretbox_easy(privateKeyBytes, nonce, wrapSecret);
// stored as `${b64(nonce)}.${b64(ct)}`
```

The server only ever stores `nonce.ciphertext` — it never sees the wrapSecret or the raw private key.

**Tradeoff:** if the user fully signs out and back in with a brand-new session that issues a new access_token with a different `sub`+`aud`+`iat`, the SHA derivation changes and the wrap blob no longer decrypts. This is intentional — it's the same property as Signal's "lost device" state. The user gets a fresh keypair generated; historical conversations show "[unable to decrypt]" for incoming messages encrypted under the old key. Backlog: a device-recovery flow where the user can prove ownership of a backup phrase to recover the old wrap secret.

## Conversation key derivation

When opening a new conversation:

```ts
const conversationKey = sodium.crypto_secretbox_keygen();  // 32 bytes
const sealedSelf = sodium.crypto_box_seal(conversationKey, myPublicKey);
const sealedPeer = sodium.crypto_box_seal(conversationKey, peerPublicKey);

POST /api/social/dm/conversations
  body: { peer_id, sealed_key_self, sealed_key_peer }
```

The server upserts `dm_conversations` with both sealed copies. `crypto_box_seal` is anonymous-sender — the server can't decrypt and the peer doesn't need to know who initially produced the conversation key.

If a conversation already exists, the upsert returns the existing sealed key (server-side `ignoreDuplicates: false`). Client unseal:

```ts
const conversationKey = sodium.crypto_box_seal_open(sealedB64, myPublicKey, myPrivateKey);
```

## Message encryption

Each message:

```ts
const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);  // 24 bytes
const ciphertext = sodium.crypto_secretbox_easy(enc(plaintext), nonce, conversationKey);

POST /api/social/dm/messages
  body: { conversation_id, encrypted_content: b64(ciphertext), iv: b64(nonce) }
```

Server stores `encrypted_content` and `iv` as TEXT on `dm_messages`. Plaintext never reaches the server.

Client decrypts on receive:

```ts
const plaintext = dec(sodium.crypto_secretbox_open_easy(fromB64(ct), fromB64(nonce), conversationKey));
```

## Realtime delivery

`dm_messages` is in the Supabase `realtime` publication. Clients subscribe via:

```ts
supabase.channel(`dm:${conversationId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conversationId}` }, handler)
```

The handler decrypts the new row with the in-memory conversation key. Realtime doesn't see plaintext either — it's just relaying ciphertext rows.

## RLS

- `dm_messages` SELECT requires `EXISTS (SELECT 1 FROM dm_conversations WHERE id = dm_messages.conversation_id AND (auth.uid() = user_a_id OR auth.uid() = user_b_id))`.
- INSERT additionally requires `auth.uid() = sender_id`.
- UPDATE allows participants to flip `read_at` / `deleted_at` only (content/iv are immutable by policy — moderators bypass via `service_role`).
- `dm_conversations` SELECT/INSERT/UPDATE require participant membership.

## Forward secrecy

Not implemented in v1. The conversation key never rotates — compromise of one conversation key reveals all past + future messages in that conversation. Backlog: monthly key rotation by inserting a system message `{ rotate: <new_sealed_keys> }` and updating the conversation row.

## What the server CAN see

- That two users have a conversation (the canonical user_a < user_b pair).
- When each message was sent + read.
- Approximate message size (ciphertext length ≈ plaintext length + 16 byte MAC).
- The sealed conversation keys (but cannot open them without the corresponding box private key).

## What the server CANNOT see

- Message content.
- The conversation key itself.
- Anyone's raw libsodium private key (only the access-token-wrapped form).

## Audit

Every moderator action that touches DM state is logged to `admin_audit_log`. Actions today: `remove_message` (sets `deleted_at`) and `restore_message` (clears it). Content is never decrypted server-side, so a moderator deleting a flagged message doesn't see what they're deleting — they act on report context only.
