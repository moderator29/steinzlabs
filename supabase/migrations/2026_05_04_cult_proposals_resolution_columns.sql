-- Resolution bookkeeping for the auto-judge cron.
--   resolved_by  : provenance string ('cron:cult-resolve-proposals' for the
--                  scheduled job, '<admin-uuid>' for manual admin closure).
--                  Lets us audit which path closed any given proposal without
--                  re-deriving from logs.
--   slashed_naka : amount burned from the author stake when a Decree fails.
--                  Always 0 for non-Decree kinds and for passed/cancelled
--                  proposals; populated by the resolution job at status flip.

ALTER TABLE cult_proposals
  ADD COLUMN IF NOT EXISTS resolved_by   text,
  ADD COLUMN IF NOT EXISTS slashed_naka  numeric(20, 2) NOT NULL DEFAULT 0
    CHECK (slashed_naka >= 0);

-- Index: resolution job filter is "active AND ends_at < now()". The existing
-- (status, ends_at DESC) index serves it; no new index needed.
