-- Naka Whale display numbering.
--
-- Every whale that has no real `label` must render a STABLE, UNIQUE display
-- handle "Naka Whale #N" that is identical across the Whale Tracker, the Whale
-- Directory and the Live Feed, on every reload. Array index / random / a
-- mod-hash (which collides) are all forbidden by the owner.
--
-- Strategy: give EVERY whale row a permanent, unique integer `naka_number`
-- drawn from a sequence. It is assigned once, persisted, and never recomputed,
-- so the same wallet always shows the same number everywhere and two different
-- wallets can never share one (enforced by a UNIQUE index). Named whales get a
-- number too (unused while they carry a label) so that if a label is ever
-- cleared the wallet still has a stable handle.
--
-- Backfill order is deterministic (oldest first_seen_at first, address as a
-- stable tiebreak) so the assignment is reproducible and low-numbered.
--
-- Additive + idempotent. No fabricated rows — this only numbers whales that
-- already exist. Applied to the live DB via Supabase MCP on 2026-07-07.

ALTER TABLE public.whales ADD COLUMN IF NOT EXISTS naka_number BIGINT;

CREATE SEQUENCE IF NOT EXISTS public.whales_naka_number_seq;

UPDATE public.whales w
SET naka_number = r.rn
FROM (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY first_seen_at ASC NULLS LAST, address ASC) AS rn
  FROM public.whales
  WHERE naka_number IS NULL
) r
WHERE w.id = r.id
  AND w.naka_number IS NULL;

-- Advance the sequence past the highest backfilled value so freshly discovered
-- whales continue the run (nextval returns MAX+1).
SELECT setval(
  'public.whales_naka_number_seq',
  GREATEST(COALESCE((SELECT MAX(naka_number) FROM public.whales), 0), 1),
  true
);

ALTER TABLE public.whales
  ALTER COLUMN naka_number SET DEFAULT nextval('public.whales_naka_number_seq');
ALTER SEQUENCE public.whales_naka_number_seq OWNED BY public.whales.naka_number;

-- Hard uniqueness guarantee: two different wallets can never share a number.
CREATE UNIQUE INDEX IF NOT EXISTS whales_naka_number_key ON public.whales (naka_number);
