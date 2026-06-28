-- #41 ZeroDev AA session keys: store the kernel smart-account address and the
-- owner-signed serialized permission approval so the background sniper cron can
-- deserialize the account with the (encrypted) session key and broadcast.
ALTER TABLE public.user_session_keys
  ADD COLUMN IF NOT EXISTS kernel_address text,
  ADD COLUMN IF NOT EXISTS approval text;
