-- CLUSTER1: unify cluster_labels naming with its peers (wallet_clusters,
-- wallet_cluster_members both already use `cluster_id`). To avoid breaking
-- code on main between this migration applying and the Branch 12 PR
-- merging, we add `cluster_id` as a column populated from `cluster_key`
-- and keep `cluster_key` writable for legacy paths. A trigger keeps the
-- two in sync. A follow-up session can drop `cluster_key` once every
-- caller is confirmed to be on `cluster_id`.
ALTER TABLE public.cluster_labels
  ADD COLUMN IF NOT EXISTS cluster_id text;

UPDATE public.cluster_labels SET cluster_id = cluster_key WHERE cluster_id IS NULL;

CREATE OR REPLACE FUNCTION public.cluster_labels_sync_id_key()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cluster_id IS NULL AND NEW.cluster_key IS NOT NULL THEN
    NEW.cluster_id := NEW.cluster_key;
  ELSIF NEW.cluster_key IS NULL AND NEW.cluster_id IS NOT NULL THEN
    NEW.cluster_key := NEW.cluster_id;
  ELSIF NEW.cluster_id <> NEW.cluster_key THEN
    -- A writer touched only one column; mirror to the other so reads
    -- on either name stay consistent.
    IF TG_OP = 'UPDATE' THEN
      IF NEW.cluster_id IS DISTINCT FROM OLD.cluster_id THEN
        NEW.cluster_key := NEW.cluster_id;
      ELSIF NEW.cluster_key IS DISTINCT FROM OLD.cluster_key THEN
        NEW.cluster_id := NEW.cluster_key;
      END IF;
    ELSE
      NEW.cluster_key := NEW.cluster_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cluster_labels_sync_id_key_trg ON public.cluster_labels;
CREATE TRIGGER cluster_labels_sync_id_key_trg
BEFORE INSERT OR UPDATE ON public.cluster_labels
FOR EACH ROW EXECUTE FUNCTION public.cluster_labels_sync_id_key();

DROP INDEX IF EXISTS public.cluster_labels_cluster_idx;
CREATE INDEX IF NOT EXISTS cluster_labels_cluster_id_idx
  ON public.cluster_labels (cluster_id, status);
-- Keep cluster_key index too for legacy callers.
CREATE INDEX IF NOT EXISTS cluster_labels_cluster_key_idx
  ON public.cluster_labels (cluster_key, status);

-- CLUSTER4: claude_api_usage telemetry. Every Claude call in
-- lib/clusters/orchestrator.ts (and elsewhere) writes a row so cost is
-- attributable per-cluster and we can detect runaway spend. Service-role
-- only; RLS denies reads to anon/auth.
CREATE TABLE IF NOT EXISTS public.claude_api_usage (
  id                bigserial PRIMARY KEY,
  occurred_at       timestamptz NOT NULL DEFAULT now(),
  caller            text NOT NULL,
  model             text NOT NULL,
  prompt_tokens     int  NOT NULL DEFAULT 0,
  completion_tokens int  NOT NULL DEFAULT 0,
  cost_usd          numeric(10,6) NOT NULL DEFAULT 0,
  cluster_id        text,
  user_id           uuid,
  duration_ms       int,
  ok                boolean NOT NULL DEFAULT true,
  error             text
);
CREATE INDEX IF NOT EXISTS claude_api_usage_occurred_idx
  ON public.claude_api_usage (occurred_at DESC);
CREATE INDEX IF NOT EXISTS claude_api_usage_caller_idx
  ON public.claude_api_usage (caller, occurred_at DESC);
CREATE INDEX IF NOT EXISTS claude_api_usage_cluster_idx
  ON public.claude_api_usage (cluster_id) WHERE cluster_id IS NOT NULL;
ALTER TABLE public.claude_api_usage ENABLE ROW LEVEL SECURITY;

-- CLUSTER5: atomic vote-count recompute with row lock. The prior pattern
-- read counts + wrote upvotes/downvotes in two non-atomic statements, so
-- two concurrent votes could race. This RPC locks the label row, recomputes
-- both counts in one query, and writes them inside the same transaction.
CREATE OR REPLACE FUNCTION public.recompute_cluster_label_votes(p_label_id uuid)
RETURNS TABLE (upvotes int, downvotes int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_up   int := 0;
  v_down int := 0;
BEGIN
  PERFORM 1 FROM public.cluster_labels WHERE id = p_label_id FOR UPDATE;

  SELECT
    COUNT(*) FILTER (WHERE vote = 1),
    COUNT(*) FILTER (WHERE vote = -1)
  INTO v_up, v_down
  FROM public.cluster_label_votes
  WHERE label_id = p_label_id;

  UPDATE public.cluster_labels
     SET upvotes = v_up,
         downvotes = v_down
   WHERE id = p_label_id;

  RETURN QUERY SELECT v_up, v_down;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_cluster_label_votes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_cluster_label_votes(uuid) TO service_role;
