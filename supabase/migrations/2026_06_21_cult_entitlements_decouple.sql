-- Decouple NakaCult membership from the platform tier ladder.
--
-- Previously `naka_cult` was the apex value of profiles.tier and implied full
-- Max-tier platform access PLUS cult access in one value. Those are now two
-- independent entitlements:
--   • platform tier  -> free | mini | pro | max  (Stripe, or a Founder Pass NFT
--                        grant added by the resolver branch)
--   • cult membership -> a separate boolean entitlement, driven by the NIPPO
--                        NFT or a >= 1,227,000 $NAKA balance
-- A user can hold either, both, or neither — a single tier column could never
-- represent that, which is the whole reason for this change.
--
-- Idempotent: safe to re-run.

-- 1. Cult-membership columns (independent of tier).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cult_member       boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cult_member_since timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cult_source       text;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_cult_source_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_cult_source_check
  CHECK (cult_source IS NULL OR cult_source IN ('nippo_nft', 'naka_holdings', 'legacy', 'admin'));

-- 1b. Ensure tier_source exists. The handoff claimed this column was already
--     live, but it is NOT present on the production profiles table (verified by
--     a failed run). The migrate step below and the NFT-resolver branch both
--     write it (platform-tier provenance: stripe / founder_pass_nft / legacy).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier_source text;

-- 2. Migrate existing apex-tier users. Under the old model a `naka_cult` tier
--    implied Max-tier platform access, so preserve exactly what they have:
--    grant the decoupled cult entitlement AND move them to `max`. No one loses
--    access — it just moves to the correct column. The resolver branch will
--    reconcile these against real on-chain holdings going forward.
UPDATE profiles
SET cult_member       = true,
    cult_source       = COALESCE(cult_source, 'legacy'),
    cult_member_since = COALESCE(cult_member_since, now()),
    tier              = 'max',
    tier_source       = COALESCE(tier_source, 'legacy')
WHERE tier = 'naka_cult';

-- 3. Drop `naka_cult` from the tier CHECK constraint now that no rows use it.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tier_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_tier_check
  CHECK (tier IN ('free', 'mini', 'pro', 'max'));

-- 4. Partial index for the cult-member count + gate lookups (CultStatsStrip,
--    isCultMember()). Only indexes the small set of actual members.
CREATE INDEX IF NOT EXISTS idx_profiles_cult_member ON profiles (cult_member) WHERE cult_member = true;
