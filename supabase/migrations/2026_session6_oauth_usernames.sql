-- §8 — OAuth (Google) signups arrived with no username, so handle_new_user
-- inserted NULL; those users rendered as a bare "@" and were dropped from
-- discovery. Applied to prod via MCP on 2026-06-23.
--
-- 1) gen_unique_username(base): slugified, case-insensitively de-duped handle.
-- 2) handle_new_user: generate a handle when none is supplied.
-- 3) backfill the existing NULL-username rows.

CREATE OR REPLACE FUNCTION public.gen_unique_username(p_base text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
BEGIN
  base := lower(regexp_replace(coalesce(p_base, ''), '[^a-zA-Z0-9]', '', 'g'));
  base := substring(base for 15);
  IF base IS NULL OR base = '' THEN base := 'user'; END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(candidate)) LOOP
    n := n + 1;
    candidate := base || n::text;
    IF n > 9999 THEN
      candidate := base || floor(random() * 1000000)::text;
      EXIT;
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id UUID; v_username TEXT; v_display TEXT; v_avatar TEXT;
  v_first TEXT; v_last TEXT; v_meta JSONB;
BEGIN
  v_id := NEW.id;
  v_meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_username := NULLIF(TRIM(v_meta->>'username'), '');
  v_display := COALESCE(NULLIF(TRIM(v_meta->>'display_name'), ''), NULLIF(TRIM(v_meta->>'full_name'), ''), NULLIF(TRIM(v_meta->>'name'), ''));
  v_avatar := COALESCE(NULLIF(TRIM(v_meta->>'avatar_url'), ''), NULLIF(TRIM(v_meta->>'picture'), ''));

  IF v_username IS NULL THEN
    v_username := public.gen_unique_username(v_display);
  END IF;

  IF v_display IS NOT NULL THEN
    v_first := split_part(v_display, ' ', 1);
    v_last := NULLIF(TRIM(substring(v_display FROM position(' ' IN v_display) + 1)), '');
  END IF;

  INSERT INTO public.profiles (id, username, display_name, avatar_url, first_name, last_name)
  VALUES (v_id, v_username, v_display, v_avatar, v_first, v_last)
  ON CONFLICT (id) DO UPDATE
    SET username = COALESCE(public.profiles.username, EXCLUDED.username),
        display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
        avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
        first_name = COALESCE(public.profiles.first_name, EXCLUDED.first_name),
        last_name = COALESCE(public.profiles.last_name, EXCLUDED.last_name);
  RETURN NEW;
END;
$function$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, display_name FROM public.profiles WHERE username IS NULL OR username = '' LOOP
    UPDATE public.profiles SET username = public.gen_unique_username(r.display_name) WHERE id = r.id;
  END LOOP;
END $$;
