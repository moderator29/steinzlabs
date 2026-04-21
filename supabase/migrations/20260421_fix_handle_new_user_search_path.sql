-- Fix: Auth signup failed with "relation \"profiles\" does not exist".
--
-- The trigger functions on auth.users INSERT (handle_new_user,
-- handle_new_user_notification_settings) are SECURITY DEFINER but had
-- no explicit search_path. Supabase's recent security hardening
-- applies an empty search_path to SECURITY DEFINER functions, so
-- bare `profiles` / `notification_settings` identifiers fail to
-- resolve and the entire auth.users INSERT aborts.
--
-- Fix: pin search_path AND schema-qualify the INSERT targets.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_id UUID;
BEGIN
  v_id := (row_to_json(NEW)->>'id')::UUID;
  INSERT INTO public.profiles (id) VALUES (v_id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_notification_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE v_id UUID;
BEGIN
  v_id := (row_to_json(NEW)->>'id')::UUID;
  INSERT INTO public.notification_settings (user_id) VALUES (v_id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;
