-- Backfill the mythic "Founding Lineage" (vault_year_one) achievement to every
-- current cult member — they are, by definition, members in the cult's founding
-- year. Idempotent: re-running grants nothing new.
--
-- This pairs with the server-side achievement-earning pipeline
-- (lib/cult/achievements.ts) that grants conclave_voter, whisper_echoed, and
-- first_seal_read at their action sites.
INSERT INTO cult_member_achievements (user_id, achievement_id)
SELECT p.id, a.id
FROM profiles p
CROSS JOIN cult_achievements a
WHERE p.cult_member = true
  AND a.code = 'vault_year_one'
  AND a.active = true
ON CONFLICT (user_id, achievement_id) DO NOTHING;
