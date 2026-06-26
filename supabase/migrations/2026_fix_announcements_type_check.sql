-- Fix the 3-way announcements.type mismatch that 500'd every create: the DB
-- CHECK allowed only (banner|modal|sticky), but the admin UI sends
-- (info|warning|maintenance|feature) and the API defaulted to 'info' — all
-- rejected by the old constraint. Align `type` to the severity/category model
-- the UI and API actually use. Safe: the table had 0 rows.
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_type_check;
ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_type_check
  CHECK (type = ANY (ARRAY['info','warning','success','critical','maintenance','feature']));
