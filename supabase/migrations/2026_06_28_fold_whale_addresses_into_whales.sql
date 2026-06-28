-- Consolidate the curated address-label registry into the canonical `whales`
-- table. whale_addresses (0 rows) was only written by the admin labeler, while
-- the feed/directory/clusters read labels from whales.label/entity_type — so
-- admin labels never surfaced. Add a discriminator so the admin list can show
-- only manually-curated rows, then drop the redundant table.
ALTER TABLE public.whales
  ADD COLUMN IF NOT EXISTS manual_label boolean NOT NULL DEFAULT false;

DROP TABLE IF EXISTS public.whale_addresses;
