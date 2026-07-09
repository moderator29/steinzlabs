-- Atomic, race-free maintenance of wire_posts.gift_count / gift_total_usd from
-- wire_gifts rows (mirrors the like/repost/reply count triggers). Replaces the
-- non-atomic read-modify-write the record route was doing, which lost counts
-- under concurrent gifts to the same post.
CREATE OR REPLACE FUNCTION public.trg_wire_gift_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.post_id IS NOT NULL THEN
      UPDATE public.wire_posts
         SET gift_count = COALESCE(gift_count, 0) + 1,
             gift_total_usd = COALESCE(gift_total_usd, 0) + COALESCE(NEW.amount_usd, 0)
       WHERE id = NEW.post_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.post_id IS NOT NULL THEN
      UPDATE public.wire_posts
         SET gift_count = GREATEST(COALESCE(gift_count, 0) - 1, 0),
             gift_total_usd = GREATEST(COALESCE(gift_total_usd, 0) - COALESCE(OLD.amount_usd, 0), 0)
       WHERE id = OLD.post_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_wire_gift_counts ON public.wire_gifts;
CREATE TRIGGER trg_wire_gift_counts
AFTER INSERT OR DELETE ON public.wire_gifts
FOR EACH ROW EXECUTE FUNCTION public.trg_wire_gift_counts();
