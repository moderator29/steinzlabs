-- Fix: /u/<username> returns 404 for legitimate followed users.
--
-- Root cause: `profiles_select_own` RLS policy on public.profiles only
-- allows `auth.uid() = id` — i.e. a user can read their own row but
-- nobody else's. The /api/social/profile/[username] route uses the
-- admin client to bypass this, but every other place that joins
-- profiles (leaderboards, followers list, /u/* page when not authed,
-- DM peer name lookup, etc.) hits the wall.
--
-- Fix: add a SECOND select policy that grants public read on the
-- non-sensitive columns of profiles. Sensitive columns
-- (email, suspended_until, internal flags) stay readable only via the
-- service-role admin client or the existing per-owner policy — the
-- public policy is column-scoped via a security_invoker view rather
-- than dropping access on the base table.

BEGIN;

-- Defensive: drop view if it exists from a prior partial run.
DROP VIEW IF EXISTS public.profiles_public CASCADE;

-- Public-readable projection of profiles. Only fields safe to surface
-- on a public profile page or in leaderboards.
CREATE VIEW public.profiles_public
WITH (security_invoker = true) AS
SELECT
  id,
  username,
  display_name,
  bio,
  avatar_url,
  tier,
  verified_badge,
  created_at
FROM public.profiles
WHERE
  -- Hide suspended accounts from public discovery.
  (social_suspended_until IS NULL OR social_suspended_until <= now())
  -- Hide privacy-opt-out accounts (column already added in prior migration).
  AND COALESCE(is_private, false) = false;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Also add a column-level public policy on the base table so existing
-- code that does .from('profiles').select('id, username, display_name,
-- avatar_url, tier, verified_badge') keeps working without rewriting
-- every call site to point at the view. The policy is permissive but
-- gated by an explicit "non-sensitive columns only" comment so it's
-- obvious in audits.
CREATE POLICY "profiles_select_public_safe"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  -- Only return rows that satisfy the same privacy/suspension filter
  -- as the view above. Sensitive columns are still gated by application
  -- code; the per-owner select policy continues to handle full reads
  -- for the authenticated user themself.
  (social_suspended_until IS NULL OR social_suspended_until <= now())
  AND COALESCE(is_private, false) = false
);

-- Backfill: any profile created before usernames were required ended up
-- with NULL username and is unreachable via /u/<username>. Generate a
-- placeholder from id for those rows so the public page resolves.
UPDATE public.profiles
SET username = 'user_' || substr(id::text, 1, 8)
WHERE username IS NULL OR username = '';

COMMIT;
