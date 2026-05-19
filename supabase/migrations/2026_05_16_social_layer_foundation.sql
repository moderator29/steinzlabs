-- ============================================================
-- Social Layer Foundation
-- ============================================================
-- Applied via MCP apply_migration on 2026-05-16. Mirrored here for
-- repo parity per CLAUDE.md.
--
-- Extends profiles with social fields (is_private, dm_permission,
-- show_* visibility flags, social_links, libsodium public_key +
-- encrypted_private_key, onboarding_completed_at, social_suspended_until).
-- Adds platform_settings.naka_threshold (DB-editable cult gating).
-- Adds 8 social tables: social_follows, social_blocks, social_mutes,
-- dm_conversations, dm_messages, user_reports,
-- social_notification_preferences. Existing user_reputation is
-- EXTENDED, not replaced.
--
-- RLS on every new table. Realtime publication adds dm_messages,
-- dm_conversations, social_follows so client subscriptions deliver
-- live DM + follow events.
-- ============================================================

-- ---------- profiles: social columns + E2E key + onboarding ----
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_private              boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dm_permission           text         NOT NULL DEFAULT 'mutual'
    CHECK (dm_permission IN ('everyone','following','mutual','nobody')),
  ADD COLUMN IF NOT EXISTS show_success_rate       boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_wallet_balance     boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_activity           boolean      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS social_links            jsonb        NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS public_key              text,
  ADD COLUMN IF NOT EXISTS encrypted_private_key   text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS social_suspended_until  timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_is_private ON public.profiles(is_private);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarded  ON public.profiles(onboarding_completed_at);

-- ---------- platform_settings: DB-editable NAKA cult threshold -
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS naka_threshold bigint NOT NULL DEFAULT 1227000;

COMMENT ON COLUMN public.platform_settings.naka_threshold IS
  'Minimum NAKA balance (raw token units) required for cult chamber gating. Reader: lib/cult/holdings.ts. Owner-editable from /admin/cult.';

-- ---------- social_follows ------------------------------------
CREATE TABLE IF NOT EXISTS public.social_follows (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'accepted'
                CHECK (status IN ('pending','accepted')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_follows_unique UNIQUE (follower_id, following_id),
  CONSTRAINT social_follows_no_self CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower  ON public.social_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.social_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_follows_status    ON public.social_follows(status);

-- ---------- social_blocks -------------------------------------
CREATE TABLE IF NOT EXISTS public.social_blocks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_blocks_unique UNIQUE (blocker_id, blocked_id),
  CONSTRAINT social_blocks_no_self CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.social_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.social_blocks(blocked_id);

-- ---------- social_mutes --------------------------------------
CREATE TABLE IF NOT EXISTS public.social_mutes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  muter_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  muted_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT social_mutes_unique UNIQUE (muter_id, muted_id),
  CONSTRAINT social_mutes_no_self CHECK (muter_id <> muted_id)
);
CREATE INDEX IF NOT EXISTS idx_mutes_muter ON public.social_mutes(muter_id);

-- ---------- dm_conversations ----------------------------------
CREATE TABLE IF NOT EXISTS public.dm_conversations (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id            uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id            uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_key_a   text        NOT NULL,
  conversation_key_b   text        NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  last_message_at      timestamptz,
  user_a_archived      boolean     NOT NULL DEFAULT false,
  user_b_archived      boolean     NOT NULL DEFAULT false,
  CONSTRAINT dm_conv_canonical CHECK (user_a_id < user_b_id),
  CONSTRAINT dm_conv_unique    UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX IF NOT EXISTS idx_dm_conv_user_a ON public.dm_conversations(user_a_id);
CREATE INDEX IF NOT EXISTS idx_dm_conv_user_b ON public.dm_conversations(user_b_id);
CREATE INDEX IF NOT EXISTS idx_dm_conv_last   ON public.dm_conversations(last_message_at DESC NULLS LAST);

-- ---------- dm_messages ---------------------------------------
CREATE TABLE IF NOT EXISTS public.dm_messages (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id    uuid        NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  sender_id          uuid        NOT NULL REFERENCES public.profiles(id)          ON DELETE CASCADE,
  encrypted_content  text        NOT NULL,
  iv                 text        NOT NULL,
  message_type       text        NOT NULL DEFAULT 'text'
                     CHECK (message_type IN ('text','image','system')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  read_at            timestamptz,
  deleted_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_dm_msg_conv_time ON public.dm_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_msg_sender    ON public.dm_messages(sender_id);

-- ---------- user_reputation: extend ---------------------------
ALTER TABLE public.user_reputation
  ADD COLUMN IF NOT EXISTS success_rate          integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS total_score           integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS copy_trade_winrate    numeric,
  ADD COLUMN IF NOT EXISTS vault_vote_accuracy   numeric,
  ADD COLUMN IF NOT EXISTS whale_pick_accuracy   numeric,
  ADD COLUMN IF NOT EXISTS community_score       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portfolio_perf_pct    numeric,
  ADD COLUMN IF NOT EXISTS activity_score        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_calculated_at    timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS rank_overall          integer,
  ADD COLUMN IF NOT EXISTS rank_followers        integer;

CREATE INDEX IF NOT EXISTS idx_reputation_success_rate ON public.user_reputation(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_rank_overall ON public.user_reputation(rank_overall);

-- ---------- user_reports --------------------------------------
CREATE TABLE IF NOT EXISTS public.user_reports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason        text        NOT NULL,
  category      text        NOT NULL DEFAULT 'other'
                CHECK (category IN ('spam','harassment','scam','impersonation','other')),
  status        text        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','resolved','dismissed')),
  admin_notes   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_reports_status   ON public.user_reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON public.user_reports(reported_id);

-- ---------- social_notification_preferences -------------------
CREATE TABLE IF NOT EXISTS public.social_notification_preferences (
  user_id                  uuid    PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  notify_new_follower      boolean NOT NULL DEFAULT true,
  notify_dm_received       boolean NOT NULL DEFAULT true,
  notify_mentioned         boolean NOT NULL DEFAULT true,
  notify_follow_request    boolean NOT NULL DEFAULT true,
  email_notifications      boolean NOT NULL DEFAULT false,
  push_notifications       boolean NOT NULL DEFAULT true,
  telegram_notifications   boolean NOT NULL DEFAULT false
);

-- ---------- RLS ----------------------------------------------
ALTER TABLE public.social_follows                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_blocks                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_mutes                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_conversations                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_notification_preferences  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follows_read_public"   ON public.social_follows;
DROP POLICY IF EXISTS "follows_insert_self"   ON public.social_follows;
DROP POLICY IF EXISTS "follows_delete_self"   ON public.social_follows;
DROP POLICY IF EXISTS "follows_update_target" ON public.social_follows;
CREATE POLICY "follows_read_public"   ON public.social_follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_self"   ON public.social_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_self"   ON public.social_follows FOR DELETE USING (auth.uid() = follower_id OR auth.uid() = following_id);
CREATE POLICY "follows_update_target" ON public.social_follows FOR UPDATE USING (auth.uid() = following_id) WITH CHECK (auth.uid() = following_id);

DROP POLICY IF EXISTS "blocks_read_self"   ON public.social_blocks;
DROP POLICY IF EXISTS "blocks_insert_self" ON public.social_blocks;
DROP POLICY IF EXISTS "blocks_delete_self" ON public.social_blocks;
CREATE POLICY "blocks_read_self"   ON public.social_blocks FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "blocks_insert_self" ON public.social_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocks_delete_self" ON public.social_blocks FOR DELETE USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "mutes_read_self"   ON public.social_mutes;
DROP POLICY IF EXISTS "mutes_insert_self" ON public.social_mutes;
DROP POLICY IF EXISTS "mutes_delete_self" ON public.social_mutes;
CREATE POLICY "mutes_read_self"   ON public.social_mutes FOR SELECT USING (auth.uid() = muter_id);
CREATE POLICY "mutes_insert_self" ON public.social_mutes FOR INSERT WITH CHECK (auth.uid() = muter_id);
CREATE POLICY "mutes_delete_self" ON public.social_mutes FOR DELETE USING (auth.uid() = muter_id);

DROP POLICY IF EXISTS "dm_conv_read_participants"   ON public.dm_conversations;
DROP POLICY IF EXISTS "dm_conv_insert_self"         ON public.dm_conversations;
DROP POLICY IF EXISTS "dm_conv_update_participants" ON public.dm_conversations;
CREATE POLICY "dm_conv_read_participants"   ON public.dm_conversations FOR SELECT USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);
CREATE POLICY "dm_conv_insert_self"         ON public.dm_conversations FOR INSERT WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);
CREATE POLICY "dm_conv_update_participants" ON public.dm_conversations FOR UPDATE USING (auth.uid() = user_a_id OR auth.uid() = user_b_id) WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "dm_msg_read_participants"   ON public.dm_messages;
DROP POLICY IF EXISTS "dm_msg_insert_sender"       ON public.dm_messages;
DROP POLICY IF EXISTS "dm_msg_update_participants" ON public.dm_messages;
CREATE POLICY "dm_msg_read_participants" ON public.dm_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.dm_conversations c WHERE c.id = dm_messages.conversation_id AND (auth.uid() = c.user_a_id OR auth.uid() = c.user_b_id))
);
CREATE POLICY "dm_msg_insert_sender" ON public.dm_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (SELECT 1 FROM public.dm_conversations c WHERE c.id = dm_messages.conversation_id AND (auth.uid() = c.user_a_id OR auth.uid() = c.user_b_id))
);
CREATE POLICY "dm_msg_update_participants" ON public.dm_messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.dm_conversations c WHERE c.id = dm_messages.conversation_id AND (auth.uid() = c.user_a_id OR auth.uid() = c.user_b_id))
);

DROP POLICY IF EXISTS "reports_read_self"   ON public.user_reports;
DROP POLICY IF EXISTS "reports_insert_self" ON public.user_reports;
CREATE POLICY "reports_read_self"   ON public.user_reports FOR SELECT USING (auth.uid() = reporter_id);
CREATE POLICY "reports_insert_self" ON public.user_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "notif_prefs_self_select" ON public.social_notification_preferences;
DROP POLICY IF EXISTS "notif_prefs_self_insert" ON public.social_notification_preferences;
DROP POLICY IF EXISTS "notif_prefs_self_update" ON public.social_notification_preferences;
CREATE POLICY "notif_prefs_self_select" ON public.social_notification_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notif_prefs_self_insert" ON public.social_notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notif_prefs_self_update" ON public.social_notification_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------- Realtime ------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_follows;
