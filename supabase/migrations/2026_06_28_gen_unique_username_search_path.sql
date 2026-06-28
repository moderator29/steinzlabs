-- Advisor 0011: pin the mutable search_path on gen_unique_username(text) so it
-- always resolves from trusted schemas regardless of the caller's search_path.
ALTER FUNCTION public.gen_unique_username(text) SET search_path = public, pg_temp;
