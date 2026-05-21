-- §3 P1-C: social_discovery table holds aggregated mention/velocity rows
-- from free social signal sources (Pump.fun bonding-curve activity,
-- 4chan /biz/ ticker mentions). RLS service-role only — the data is
-- not user-scoped and the public ContextFeed reads it via the API route
-- layer, not direct browser queries.

CREATE TABLE IF NOT EXISTS public.social_discovery (
  id              bigserial PRIMARY KEY,
  source          text NOT NULL CHECK (source IN ('pumpfun', 'biz_4chan')),
  symbol          text,                            -- canonical-ish ticker e.g. WIF
  token_address   text,                            -- where applicable (pumpfun mint)
  chain           text,                            -- 'solana' for pumpfun, null for /biz/
  mention_count   int NOT NULL DEFAULT 0,
  thread_count    int NOT NULL DEFAULT 0,
  velocity_score  numeric,                         -- pumpfun: bonding-curve acceleration; /biz/: mentions-per-hour delta
  window_start    timestamptz NOT NULL,
  window_end      timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_discovery_source_recent_idx
  ON public.social_discovery (source, window_end DESC);

CREATE INDEX IF NOT EXISTS social_discovery_symbol_idx
  ON public.social_discovery (symbol)
  WHERE symbol IS NOT NULL;

ALTER TABLE public.social_discovery ENABLE ROW LEVEL SECURITY;

-- No public policy. Only the service-role key reads / writes this table.
-- ContextFeed surfaces social_discovery rows via /api/context-feed which
-- runs server-side with the admin client and applies presentation filters.
