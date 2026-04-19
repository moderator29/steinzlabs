-- ═══════════════════════════════════════════════════════════════
-- NAKA LABS — SESSION 5B-2 PHASE 0.5b — verified flag on profiles
--
-- 1. Adds is_verified BOOLEAN to profiles for the gold-badge UI.
-- 2. Auto-upgrades the test account (phantomfcalls@gmail.com) to Max + verified.
--
-- Safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Schema ──────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS profiles_is_verified_idx
  ON profiles(is_verified) WHERE is_verified = TRUE;

-- ── 2. Seed test account ───────────────────────────────────────────
-- This auto-runs as part of the migration. Idempotent — re-running just
-- re-affirms tier=max + is_verified=true. If the user has no profile row
-- yet (signed up before profiles trigger existed), insert one.
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'phantomfcalls@gmail.com';

  IF v_user_id IS NOT NULL THEN
    -- Try update first.
    UPDATE profiles
       SET tier = 'max',
           is_verified = TRUE,
           tier_expires_at = NULL,
           updated_at = NOW()
     WHERE id = v_user_id;

    -- If no row existed, create it.
    IF NOT FOUND THEN
      INSERT INTO profiles (id, tier, is_verified, role, created_at, updated_at)
      VALUES (v_user_id, 'max', TRUE, 'user', NOW(), NOW());
    END IF;

    RAISE NOTICE '[seed] phantomfcalls@gmail.com upgraded to tier=max + is_verified=true';
  ELSE
    RAISE NOTICE '[seed] phantomfcalls@gmail.com auth user not found — sign up first, then re-run this migration';
  END IF;
END $$;
