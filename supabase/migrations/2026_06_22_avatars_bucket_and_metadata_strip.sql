-- Fix the 494 REQUEST_HEADER_TOO_LARGE login wall.
--
-- Root cause: ProfileTab saved uploaded avatar/cover images as base64 data-URLs
-- into Supabase user_metadata (auth.updateUser({ data: { avatar_url: <base64> }})).
-- user_metadata is embedded in the session, which lives in cookies, so a single
-- 300KB image ballooned the session cookie to ~440KB → the Vercel edge rejected
-- every request with a 494. The code now uploads to this Storage bucket and
-- stores only a short public URL.
--
-- Idempotent.

-- ── 1. Public avatars bucket (avatars + covers) ──────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880,
        ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'];

-- RLS on storage.objects: public read; a user may only write under their own
-- uid folder (path "<uid>/avatar.png", "<uid>/cover.png").
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_user_insert" ON storage.objects;
CREATE POLICY "avatars_user_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_user_update" ON storage.objects;
CREATE POLICY "avatars_user_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_user_delete" ON storage.objects;
CREATE POLICY "avatars_user_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── 2. UNBLOCK: strip base64 data-URLs out of auth metadata ──────────────────
-- This is what immediately shrinks every affected session so users can log in
-- again. Only removes the field when it is a base64 data-URL — real http(s)
-- avatar URLs (e.g. Google OAuth) are preserved.
UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data - 'avatar_url'
WHERE raw_user_meta_data->>'avatar_url' LIKE 'data:%';

UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data - 'cover_url'
WHERE raw_user_meta_data->>'cover_url' LIKE 'data:%';

-- Mirror table cleanup (profiles.avatar_url got the base64 copied in by the
-- handle_new_user trigger). Doesn't affect the 494 — profiles isn't in the
-- session — but keeps the rows from carrying 300KB blobs.
UPDATE public.profiles SET avatar_url = NULL WHERE avatar_url LIKE 'data:%';
