CREATE TABLE IF NOT EXISTS public.telegram_delivery_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chat_id bigint,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  url text,
  error_message text NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tg_failures_user ON public.telegram_delivery_failures(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tg_failures_unresolved ON public.telegram_delivery_failures(resolved_at) WHERE resolved_at IS NULL;

ALTER TABLE public.telegram_delivery_failures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tg_failures_owner_select ON public.telegram_delivery_failures;
CREATE POLICY tg_failures_owner_select ON public.telegram_delivery_failures
  FOR SELECT USING (auth.uid() = user_id);
