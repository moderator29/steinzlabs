-- ADM1: admin roles + permission matrix. Replaces the single-bit
-- profiles.role='admin' check with a granular role per admin user.
CREATE TABLE IF NOT EXISTS public.admin_roles (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          text NOT NULL CHECK (role IN ('super_admin','support','moderator','finance','read_only')),
  granted_by    uuid REFERENCES auth.users(id),
  granted_at    timestamptz NOT NULL DEFAULT now(),
  totp_secret   text,
  totp_enrolled boolean NOT NULL DEFAULT false,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS admin_roles_role_idx ON public.admin_roles (role);
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_roles_select_own
  ON public.admin_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ADM4: extend the existing admin_audit_log (id, admin_id, target_user_id,
-- action, details jsonb, created_at) without breaking current inserts.
ALTER TABLE public.admin_audit_log
  ADD COLUMN IF NOT EXISTS target_type  text,
  ADD COLUMN IF NOT EXISTS before_state jsonb,
  ADD COLUMN IF NOT EXISTS after_state  jsonb,
  ADD COLUMN IF NOT EXISTS ip_address   inet,
  ADD COLUMN IF NOT EXISTS user_agent   text;
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);

-- ADM4: feature flags + initial seeds.
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key           text PRIMARY KEY,
  enabled       boolean NOT NULL DEFAULT false,
  description   text,
  rollout_pct   int NOT NULL DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
  updated_by    uuid REFERENCES auth.users(id),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feature_flags_enabled_idx ON public.feature_flags (enabled);
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY feature_flags_public_read
  ON public.feature_flags FOR SELECT
  TO authenticated, anon
  USING (true);

INSERT INTO public.feature_flags (key, description, enabled) VALUES
  ('sniper.enabled',          'Master switch for the sniper engine.',                    true),
  ('copy_trading.enabled',    'Master switch for copy-trading execution.',               true),
  ('lifi_bridge.enabled',     'Cross-chain bridge surfaces (LiFi).',                     true),
  ('vtx.streaming.enabled',   'Server-sent VTX response streaming.',                     true),
  ('passkey_unlock.enabled',  'WebAuthn passkey unlock for built-in wallet (prototype).', false)
ON CONFLICT (key) DO NOTHING;

-- ADM6: short-lived impersonation tokens.
CREATE TABLE IF NOT EXISTS public.admin_impersonation_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jti           text NOT NULL UNIQUE,
  issued_at     timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  reason        text NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_impersonation_active_idx
  ON public.admin_impersonation_tokens (expires_at)
  WHERE revoked_at IS NULL;
ALTER TABLE public.admin_impersonation_tokens ENABLE ROW LEVEL SECURITY;
