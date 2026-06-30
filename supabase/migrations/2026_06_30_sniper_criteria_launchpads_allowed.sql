-- Make Snipe Protection real (not visual-only): persist the per-launchpad
-- allowlist chosen in the New Sniper modal. null/empty = all launchpads allowed.
alter table sniper_criteria add column if not exists launchpads_allowed text[];
