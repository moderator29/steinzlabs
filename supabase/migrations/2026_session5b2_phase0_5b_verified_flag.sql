-- ═══════════════════════════════════════════════════════════════
-- NAKA LABS — SESSION 5B-2 PHASE 0.5b — verified flag on profiles
--
-- Adds an `is_verified` boolean to profiles so the dashboard can render
-- a verified-checkmark badge next to the user's display name.
-- Source-of-truth for verified status; admins toggle this manually for
-- now (future: KYC integration writes here).
--
-- Safe to re-run.
--
-- After running, set Max-tier + verified for any seed account:
--   UPDATE profiles
--      SET tier = 'max', is_verified = true
--    WHERE id = (SELECT id FROM auth.users WHERE email = 'phantomfcalls@gmail.com');
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS profiles_is_verified_idx
  ON profiles(is_verified) WHERE is_verified = TRUE;
