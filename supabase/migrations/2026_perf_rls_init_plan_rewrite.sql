-- §11 deferral: rewrite auth.<fn>() → (select auth.<fn>()) in RLS policies.
-- Postgres caches the SELECT result so it's evaluated once per query
-- instead of per row. Same auth result, just faster at scale.
-- Source: Supabase advisor lint 0003.
--
-- Strategy: PL/pgSQL loop over pg_policies. Negative lookbehind regex
-- skips already-wrapped instances so we don't double-wrap. ALTER POLICY
-- preserves CMD/ROLES/PERMISSIVE — only the qual / with_check change.
-- Already applied on live; idempotent (re-running detects 0 unwrapped).

DO $body$
DECLARE
  pol RECORD;
  new_qual TEXT;
  new_check TEXT;
  ddl TEXT;
  rewrites INT := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual ~* '(?<!select\s)auth\.(uid|role|jwt|email)\(\)')
        OR (with_check ~* '(?<!select\s)auth\.(uid|role|jwt|email)\(\)')
      )
  LOOP
    new_qual := pol.qual;
    new_check := pol.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := regexp_replace(new_qual, '(?<!select\s)auth\.(uid|role|jwt|email)\(\)', '(select auth.\1())', 'gi');
    END IF;
    IF new_check IS NOT NULL THEN
      new_check := regexp_replace(new_check, '(?<!select\s)auth\.(uid|role|jwt|email)\(\)', '(select auth.\1())', 'gi');
    END IF;

    ddl := format('ALTER POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    IF pol.qual IS NOT NULL THEN
      ddl := ddl || ' USING (' || new_qual || ')';
    END IF;
    IF pol.with_check IS NOT NULL THEN
      ddl := ddl || ' WITH CHECK (' || new_check || ')';
    END IF;

    EXECUTE ddl;
    rewrites := rewrites + 1;
  END LOOP;

  RAISE NOTICE 'Rewrote % RLS policies (auth.<fn>() → (select auth.<fn>()))', rewrites;
END $body$;
