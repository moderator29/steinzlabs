-- Support ticket system.
-- Two tables: support_tickets (header + status) and ticket_replies (thread).
-- RLS: users see only their own tickets and replies. Admins (service_role)
-- see everything. Internal admin notes are hidden from the user via
-- the `internal` flag on replies.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject      TEXT NOT NULL,
  description  TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'other',
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority     TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_to  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ticket_replies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user','admin','system')),
  sender_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message     TEXT NOT NULL,
  internal    BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_replies_ticket ON public.ticket_replies (ticket_id, created_at);

-- keep updated_at fresh on any ticket change.
CREATE OR REPLACE FUNCTION public.support_tickets_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'resolved' AND OLD.status <> 'resolved' THEN
    NEW.resolved_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_touch_trg ON public.support_tickets;
CREATE TRIGGER support_tickets_touch_trg
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.support_tickets_touch();

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_replies  ENABLE ROW LEVEL SECURITY;

-- Policies: users on their own rows.
DROP POLICY IF EXISTS "support_tickets_own" ON public.support_tickets;
CREATE POLICY "support_tickets_own" ON public.support_tickets
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "support_tickets_service" ON public.support_tickets;
CREATE POLICY "support_tickets_service" ON public.support_tickets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users see replies in their tickets, but never internal notes.
DROP POLICY IF EXISTS "ticket_replies_own_read" ON public.ticket_replies;
CREATE POLICY "ticket_replies_own_read" ON public.ticket_replies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_replies.ticket_id AND t.user_id = auth.uid()
    )
    AND internal = false
  );

-- Users insert their own user-type replies on their own tickets.
DROP POLICY IF EXISTS "ticket_replies_own_write" ON public.ticket_replies;
CREATE POLICY "ticket_replies_own_write" ON public.ticket_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_type = 'user'
    AND sender_id = auth.uid()
    AND internal = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_replies.ticket_id AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ticket_replies_service" ON public.ticket_replies;
CREATE POLICY "ticket_replies_service" ON public.ticket_replies
  FOR ALL TO service_role USING (true) WITH CHECK (true);
