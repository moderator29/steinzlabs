-- §S1-DATA — handle_new_user() was inserting only id, leaving every other
-- profile column NULL. Result: User Search returned nothing, no avatars
-- rendered, leaderboards looked empty. Fix the trigger + backfill existing
-- rows from auth.users.raw_user_meta_data (Google OAuth populates
-- full_name, avatar_url, and username on first sign-in).
--
-- Already applied to the live database via Supabase MCP on 2026-05-20.
-- This file is the durable record so reset/branch/CI runs reproduce it.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id          UUID;
  v_username    TEXT;
  v_display     TEXT;
  v_avatar      TEXT;
  v_first       TEXT;
  v_last        TEXT;
  v_meta        JSONB;
BEGIN
  v_id    := NEW.id;
  v_meta  := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  v_username := NULLIF(TRIM(v_meta->>'username'), '');
  v_display  := COALESCE(
                  NULLIF(TRIM(v_meta->>'display_name'), ''),
                  NULLIF(TRIM(v_meta->>'full_name'), ''),
                  NULLIF(TRIM(v_meta->>'name'), '')
                );
  v_avatar   := COALESCE(
                  NULLIF(TRIM(v_meta->>'avatar_url'), ''),
                  NULLIF(TRIM(v_meta->>'picture'), '')
                );

  IF v_display IS NOT NULL THEN
    v_first := split_part(v_display, ' ', 1);
    v_last  := NULLIF(TRIM(substring(v_display FROM position(' ' IN v_display) + 1)), '');
  END IF;

  INSERT INTO public.profiles (id, username, display_name, avatar_url, first_name, last_name)
  VALUES (v_id, v_username, v_display, v_avatar, v_first, v_last)
  ON CONFLICT (id) DO UPDATE
    SET username     = COALESCE(public.profiles.username,     EXCLUDED.username),
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
        avatar_url   = COALESCE(public.profiles.avatar_url,   EXCLUDED.avatar_url),
        first_name   = COALESCE(public.profiles.first_name,   EXCLUDED.first_name),
        last_name    = COALESCE(public.profiles.last_name,    EXCLUDED.last_name);
  RETURN NEW;
END;
$function$;

UPDATE public.profiles p
SET
  username = COALESCE(p.username,
                      NULLIF(TRIM(u.raw_user_meta_data->>'username'), '')),
  display_name = COALESCE(p.display_name,
                          NULLIF(TRIM(u.raw_user_meta_data->>'display_name'), ''),
                          NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
                          NULLIF(TRIM(u.raw_user_meta_data->>'name'), '')),
  avatar_url = COALESCE(p.avatar_url,
                        NULLIF(TRIM(u.raw_user_meta_data->>'avatar_url'), ''),
                        NULLIF(TRIM(u.raw_user_meta_data->>'picture'), '')),
  first_name = COALESCE(p.first_name,
                        split_part(COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'display_name', ''), ' ', 1)),
  last_name = COALESCE(p.last_name,
                       NULLIF(TRIM(substring(
                          COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'display_name', '')
                          FROM position(' ' IN COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'display_name', '')) + 1
                       )), ''))
FROM auth.users u
WHERE u.id = p.id
  AND (p.username IS NULL OR p.display_name IS NULL OR p.avatar_url IS NULL);
