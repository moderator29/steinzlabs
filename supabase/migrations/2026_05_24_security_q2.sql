-- C.7: idempotency keys. Replay-safe execution for /api/sniper/execute
-- and /api/copy-trading/execute. Routes read Idempotency-Key from the
-- request header; if a row exists for (user_id, key), the route returns
-- the cached response_body verbatim. Otherwise it executes + caches.
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key            text NOT NULL,
  endpoint       text NOT NULL,
  request_hash   text NOT NULL,
  status_code    int NOT NULL,
  response_body  jsonb NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);
CREATE INDEX IF NOT EXISTS idempotency_keys_created_idx
  ON public.idempotency_keys (created_at);
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
