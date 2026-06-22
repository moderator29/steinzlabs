-- 2026-06-22 — harden dm_messages UPDATE.
-- The existing policy had USING (participant) but no WITH CHECK, and
-- `authenticated` held table-wide UPDATE — so a conversation participant could
-- rewrite another member's encrypted_content or spoof sender_id via direct
-- PostgREST. RLS can't compare OLD/NEW, so column scope is enforced with grants:
-- a participant may only flip the read/delete flags, never message content or
-- identity. The app's DM routes use the service role and are unaffected.
REVOKE UPDATE ON public.dm_messages FROM authenticated;
GRANT UPDATE (read_at, deleted_at) ON public.dm_messages TO authenticated;

DROP POLICY IF EXISTS dm_msg_update_participants ON public.dm_messages;
CREATE POLICY dm_msg_update_participants ON public.dm_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_conversations c
      WHERE c.id = dm_messages.conversation_id
        AND (auth.uid() = c.user_a_id OR auth.uid() = c.user_b_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dm_conversations c
      WHERE c.id = dm_messages.conversation_id
        AND (auth.uid() = c.user_a_id OR auth.uid() = c.user_b_id)
    )
  );
