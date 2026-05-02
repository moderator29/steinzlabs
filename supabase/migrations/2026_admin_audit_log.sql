-- §13b — durable audit trail for every admin write action.
-- Replaces the console.log() pattern in /api/admin/users that left
-- no record after the lambda exited. Required for compliance review
-- of who changed whose tier / banned whom / changed roles / deleted
-- accounts. Append-only — no UPDATE/DELETE policy. Service role bypass
-- is used by /api/admin/users (server-only).

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action          text NOT NULL CHECK (action IN ('set_tier','set_role','ban','unban','delete','other')),
  details         jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id
  ON public.admin_audit_log (target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id
  ON public.admin_audit_log (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at_desc
  ON public.admin_audit_log (created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT policy: only service-role (server-only routes
-- using getSupabaseAdmin) can read or write. Standard users cannot
-- see or tamper with the audit log even via direct API access.
