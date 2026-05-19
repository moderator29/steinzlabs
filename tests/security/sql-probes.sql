-- Section-10 security probes — S1 + S4 portions.
-- Run against the TEST database only. These are read-only SELECTs
-- intended to confirm RLS + DM encryption guarantees from psql.

-- S1 — DM bodies are not decryptable server-side.
-- Confirms social_messages has ciphertext + nonce columns but no
-- plaintext column. Replace <row-id> with a known message id.

\echo '--- S1: social_messages columns ---'
SELECT column_name FROM information_schema.columns
WHERE table_name = 'social_messages'
ORDER BY ordinal_position;

\echo '--- S1: zero plaintext columns ---'
SELECT COUNT(*) AS plaintext_column_count
FROM information_schema.columns
WHERE table_name = 'social_messages'
  AND column_name IN ('body', 'plaintext', 'content');
-- expected: 0

-- S4 — RLS cross-user isolation.
-- Run twice: once as Alice's JWT, once as Bob's. Each should see only
-- their own block rows (zero rows that reference the other user).

\echo '--- S4: bob enumerating alice block list ---'
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', :'bob_uuid')::text, true);
SELECT COUNT(*) AS visible_to_bob
FROM social_blocks
WHERE blocker_id = :'alice_uuid'::uuid;
-- expected: 0
RESET ROLE;
