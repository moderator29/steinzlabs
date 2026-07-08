-- Enforce that no two users can share a username, case-insensitive
-- ("Puffnutz" == "puffnutz"). The app lowercases + ilike-matches usernames, so
-- uniqueness must be on lower(username). Applied live via MCP on 2026-07-08 after
-- resolving the one historical collision (a dead duplicate account was renamed).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key ON public.profiles (lower(username));
