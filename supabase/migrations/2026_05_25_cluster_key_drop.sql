-- CLUSTER1 finish — drop the legacy cluster_labels.cluster_key column.
-- Session U Branch 12 introduced cluster_id as canonical with a trigger
-- syncing the two while callers migrated. All current writers use
-- cluster_id; the labels route still accepts cluster_key as an input
-- alias (passes through to cluster_id), which keeps working after the
-- column drop.
--
-- sybil_cluster_candidates has its own unrelated cluster_key column on
-- a different table — left untouched.

DROP TRIGGER IF EXISTS cluster_labels_sync_id_key_trg ON public.cluster_labels;
DROP FUNCTION IF EXISTS public.cluster_labels_sync_id_key();
DROP INDEX  IF EXISTS public.cluster_labels_cluster_key_idx;
ALTER TABLE public.cluster_labels DROP COLUMN IF EXISTS cluster_key;
