-- ═══════════════════════════════════════════════════════════════
-- NAKA LABS — SESSION 5B-2 PHASE 0.5a — profile columns
-- Adds role + tier_expires_at to profiles (pre-req for admin auth
-- + Phase 1 payments flow). Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMPTZ;

-- Tier CHECK may have been added with fewer values previously.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tier_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_tier_check
  CHECK (tier IN ('free', 'mini', 'pro', 'max'));

CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role) WHERE role = 'admin';
CREATE INDEX IF NOT EXISTS profiles_tier_expires_idx ON profiles(tier_expires_at)
  WHERE tier_expires_at IS NOT NULL;
