-- #28: whale_addresses "Admins manage whales" trusted raw_user_meta_data->>'role',
-- which any user can self-set via auth.updateUser({data:{role:'admin'}}) — a
-- privilege escalation. Rebind to the DB-driven source of truth (profiles.role).
DROP POLICY IF EXISTS "Admins manage whales" ON public.whale_addresses;
CREATE POLICY "Admins manage whales" ON public.whale_addresses
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- #32: cult_stats is a SECURITY DEFINER view (advisor ERROR 0010) — it bypasses
-- the querying user's RLS. Make it security_invoker so it respects caller RLS.
ALTER VIEW public.cult_stats SET (security_invoker = true);
