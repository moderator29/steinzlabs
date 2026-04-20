-- §2.9: cache table for Claude-generated whale AI summaries. 24h TTL
-- enforced at the query layer (WHERE generated_at > now() - 24h). Storing
-- per (whale_address, chain) so the same address on different chains can
-- have independent analyses.

CREATE TABLE IF NOT EXISTS whale_ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whale_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  rating_30d INTEGER NOT NULL CHECK (rating_30d BETWEEN 0 AND 10),
  rating_10d INTEGER NOT NULL CHECK (rating_10d BETWEEN 0 AND 10),
  sentiment TEXT NOT NULL CHECK (sentiment IN ('bullish', 'bearish', 'neutral')),
  style TEXT NOT NULL,
  summary TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (whale_address, chain)
);

-- Lookup path is always (address, chain) equality — covered by the unique
-- constraint's implicit index. Secondary index on generated_at for cache
-- cleanup jobs later.
CREATE INDEX IF NOT EXISTS idx_whale_ai_summaries_generated
  ON whale_ai_summaries (generated_at);
