-- 20260708_harden_function_search_path.sql
-- Security hardening. Pins a fixed search_path on the 9 functions flagged by the
-- Supabase security advisor (function_search_path_mutable). A role-mutable
-- search_path lets a caller's session search_path influence name resolution
-- inside the function — a privilege-escalation vector.
--
-- We use `pg_catalog, public` (NOT '') on purpose: several of these functions
-- reference public objects UNQUALIFIED (e.g. try_acquire_cron_lock -> cron_locks),
-- so search_path = '' would break them. pg_catalog first pins built-ins; public
-- preserves existing unqualified resolution. This is behaviour-preserving and
-- cannot fail on existing data.

ALTER FUNCTION public.try_acquire_cron_lock(text, integer)                                              SET search_path = pg_catalog, public;
ALTER FUNCTION public.release_cron_lock(text)                                                           SET search_path = pg_catalog, public;
ALTER FUNCTION public.freeze_session_key_caps()                                                         SET search_path = pg_catalog, public;
ALTER FUNCTION public.aa_daily_spend_usd(uuid, text, timestamp with time zone)                          SET search_path = pg_catalog, public;
ALTER FUNCTION public.lock_mm_accounting()                                                              SET search_path = pg_catalog, public;
ALTER FUNCTION public.mark_all_notifications_read()                                                     SET search_path = pg_catalog, public;
ALTER FUNCTION public.aa_active_reserved_usd(uuid, text)                                                SET search_path = pg_catalog, public;
ALTER FUNCTION public.aa_reserve_daily_spend(uuid, text, numeric, numeric, timestamp with time zone, integer) SET search_path = pg_catalog, public;
ALTER FUNCTION public.aa_release_reservation(uuid)                                                      SET search_path = pg_catalog, public;
