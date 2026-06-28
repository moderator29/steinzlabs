-- #28 (sweep): platform_fees "Admins read fees" also gated on the
-- self-settable raw_user_meta_data->>'role'. Rebind to profiles.role.
DROP POLICY IF EXISTS "Admins read fees" ON public.platform_fees;
CREATE POLICY "Admins read fees" ON public.platform_fees
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
