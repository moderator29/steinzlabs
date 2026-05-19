-- Onboarding event funnel + A/B variant + security pipeline caches.
-- Applied via MCP apply_migration on 2026-05-16. Mirrored for repo parity.

CREATE TABLE IF NOT EXISTS public.onboarding_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES public.profiles(id) ON DELETE CASCADE,
  event       text        NOT NULL CHECK (event IN ('viewed','clicked_next','clicked_skip','skip_confirmed','completed','replay_started')),
  card_index  integer,
  variant     text,
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_user  ON public.onboarding_events(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_event ON public.onboarding_events(event);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_when  ON public.onboarding_events(created_at DESC);
ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "onboarding_events_self_insert" ON public.onboarding_events;
DROP POLICY IF EXISTS "onboarding_events_self_read"   ON public.onboarding_events;
CREATE POLICY "onboarding_events_self_insert" ON public.onboarding_events FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "onboarding_events_self_read"   ON public.onboarding_events FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.security_source_verdicts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  chain           text        NOT NULL,
  token_address   text        NOT NULL,
  source          text        NOT NULL CHECK (source IN ('goplus','honeypot_is','de_fi','rugcheck')),
  verdict         text        NOT NULL CHECK (verdict IN ('honeypot','safe','unknown')),
  raw             jsonb,
  fetched_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain, token_address, source)
);
CREATE INDEX IF NOT EXISTS idx_source_verdicts_token ON public.security_source_verdicts(chain, token_address);
CREATE INDEX IF NOT EXISTS idx_source_verdicts_age   ON public.security_source_verdicts(fetched_at);
ALTER TABLE public.security_source_verdicts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "source_verdicts_read_public" ON public.security_source_verdicts;
CREATE POLICY "source_verdicts_read_public" ON public.security_source_verdicts FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.deployer_history_cache (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  chain             text        NOT NULL,
  deployer_address  text        NOT NULL,
  trust_score       integer     NOT NULL,
  band              text        NOT NULL CHECK (band IN ('pristine','clean','caution','dangerous','serial-rugger')),
  total_deployed    integer     NOT NULL,
  total_dead        integer     NOT NULL,
  total_flagged     integer     NOT NULL,
  fast_deaths       integer     NOT NULL,
  notable           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  fetched_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chain, deployer_address)
);
CREATE INDEX IF NOT EXISTS idx_deployer_cache_age ON public.deployer_history_cache(fetched_at);
ALTER TABLE public.deployer_history_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deployer_cache_read_public" ON public.deployer_history_cache;
CREATE POLICY "deployer_cache_read_public" ON public.deployer_history_cache FOR SELECT USING (true);
