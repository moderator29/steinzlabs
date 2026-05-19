CREATE TABLE IF NOT EXISTS public.vapid_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL UNIQUE,
  public_key text NOT NULL,
  private_key text NOT NULL,
  subject text NOT NULL DEFAULT 'mailto:support@nakalabs.xyz',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'grace', 'retired')),
  activated_at timestamptz NOT NULL DEFAULT now(),
  grace_starts_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vapid_keys_status ON public.vapid_keys(status);
CREATE INDEX IF NOT EXISTS idx_vapid_keys_active ON public.vapid_keys(version DESC) WHERE status = 'active';

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS vapid_key_version integer;

ALTER TABLE public.vapid_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vapid_keys_no_select ON public.vapid_keys;
