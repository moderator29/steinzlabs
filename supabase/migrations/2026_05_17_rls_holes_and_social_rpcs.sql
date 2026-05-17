-- Applied via MCP apply_migration on 2026-05-17. Mirrored for repo parity.
-- Combines two related fixes from the 20-agent audit:
--   1. P0 RLS holes on push_delivery_log + threats
--   2. auto_copy enum + dedup uniqueness + social leaderboard / block RPCs

-- ---------- RLS holes (P0) ------------------------------------
ALTER TABLE public.push_delivery_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_delivery_log_self_select" ON public.push_delivery_log;
CREATE POLICY "push_delivery_log_self_select" ON public.push_delivery_log
  FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.threats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "threats_public_select" ON public.threats;
CREATE POLICY "threats_public_select" ON public.threats
  FOR SELECT USING (true);

-- ---------- copy_mode enum: add 'auto_copy' -------------------
ALTER TABLE public.user_whale_follows
  DROP CONSTRAINT IF EXISTS user_whale_follows_copy_mode_check;
ALTER TABLE public.user_whale_follows
  ADD CONSTRAINT user_whale_follows_copy_mode_check
  CHECK (copy_mode IN ('alerts','oneclick','auto_copy'));

-- ---------- copy-trade dedup uniqueness -----------------------
CREATE UNIQUE INDEX IF NOT EXISTS user_copy_trades_user_source_tx_uniq
  ON public.user_copy_trades(user_id, source_tx_hash)
  WHERE source_tx_hash IS NOT NULL;

-- ---------- social_top_followers RPC --------------------------
CREATE OR REPLACE FUNCTION public.social_top_followers(p_limit integer DEFAULT 100)
RETURNS TABLE(
  id              uuid,
  followers       bigint,
  username        text,
  display_name    text,
  avatar_url      text,
  tier            text,
  verified_badge  text,
  is_chosen       boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.id,
    COUNT(f.id)::bigint AS followers,
    p.username,
    p.display_name,
    p.avatar_url,
    p.tier,
    p.verified_badge,
    p.is_chosen
  FROM public.profiles p
  LEFT JOIN public.social_follows f
    ON f.following_id = p.id AND f.status = 'accepted'
  GROUP BY p.id
  ORDER BY followers DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 500));
$$;

-- ---------- social_block_analytics RPC ------------------------
CREATE OR REPLACE FUNCTION public.social_block_analytics(p_limit integer DEFAULT 20)
RETURNS TABLE(
  kind        text,
  user_id     uuid,
  count       bigint,
  username    text,
  display_name text,
  avatar_url  text,
  tier        text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH block_counts AS (
    SELECT 'blocks'::text AS kind, blocked_id AS user_id, COUNT(*)::bigint AS count
    FROM public.social_blocks
    GROUP BY blocked_id
  ),
  mute_counts AS (
    SELECT 'mutes'::text AS kind, muted_id AS user_id, COUNT(*)::bigint AS count
    FROM public.social_mutes
    GROUP BY muted_id
  ),
  combined AS (
    SELECT * FROM block_counts
    UNION ALL
    SELECT * FROM mute_counts
  ),
  ranked AS (
    SELECT
      c.kind, c.user_id, c.count,
      ROW_NUMBER() OVER (PARTITION BY c.kind ORDER BY c.count DESC) AS rn
    FROM combined c
  )
  SELECT r.kind, r.user_id, r.count, p.username, p.display_name, p.avatar_url, p.tier
  FROM ranked r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.rn <= GREATEST(1, LEAST(p_limit, 100));
$$;
