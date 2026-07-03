-- admin_id was NOT NULL yet its FK is ON DELETE SET NULL (contradiction), and
-- static-bearer UI logins have no user_id to attribute — so those actions
-- could never be logged. Allow NULL admin_id for system/bearer actions.
ALTER TABLE public.admin_audit_log ALTER COLUMN admin_id DROP NOT NULL;
