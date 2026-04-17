# Login Loop — Root Cause Audit (2026-04-17)

## Symptom
After a successful password login, `/dashboard` rendered for ~10s then redirected back to `/login?session=expired`. Infinite loop. Pre-existing from Session 4 hotfix.

## Root cause

**File:** `lib/hooks/useSessionGuard.ts`
**Lines (broken):** 54–68 (original)

```ts
const cookie = getCookie(SESSION_COOKIE);  // "steinz_session"
if (!cookie) {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      // Session token was cleared externally — enforce sign-out
      await signOutAndRedirect();
      return;
    }
  }
  router.replace('/login');
  return;
}
```

`useSessionGuard` required a **legacy** cookie named `steinz_session`. That cookie is **no longer issued** by the email/password sign-in path. The login page explicitly stopped writing it (see `app/login/page.tsx:225`, comment "do NOT set a custom `steinz_session` cookie"). It is only set by `/auth/callback` for OAuth.

Flow of the bug:
1. User signs in with email/password → `@supabase/ssr` writes `sb-<ref>-auth-token.*` cookies → middleware lets `/dashboard` through.
2. `SessionGuardProvider` mounts, calls `useSessionGuard()`.
3. First `useEffect` runs `checkSession()` **immediately**.
4. `getCookie('steinz_session')` → `null` (legacy cookie not set).
5. Branch falls into the `if (data.session)` block → treats "cookie missing while Supabase session present" as "token cleared externally" → calls `signOutAndRedirect()`.
6. That nukes the Supabase session and redirects to `/login?session=expired`.

Time-to-kickback ≈ dashboard render + `getSession()` round-trip ≈ 5–10s, matching the reported symptom.

## Other candidates ruled out

- **(A) IDLE_TIMEOUT_MS too low** — ruled out. Constant was `60 * 60 * 1000` (1 hour), not 10s.
- **(B) Middleware racing the cookie** — ruled out. `/dashboard` clearly loaded ("Loading All Chains Feed" was visible), so middleware already saw the session.
- **(C) Soft navigation instead of hard redirect** — already correct. `app/login/page.tsx:242` uses `window.location.assign(destination)`.
- **(D) onAuthStateChange signing out on mount** — not the culprit. `useAuth` handles SIGNED_OUT by nulling state, not redirecting.
- **(E) Cookie flags wrong** — not the culprit. `@supabase/ssr` handles Secure/SameSite correctly on Vercel.
- **(F) Duplicate useAuth subscription** — not observed; single `AuthProvider` at the root.

## Fix

**File:** `lib/hooks/useSessionGuard.ts`

- Removed the `steinz_session` cookie dependency entirely. Supabase session is now the sole source of truth.
- Kept the 1-hour idle-timeout logic.
- Added a 2-second defer on the initial `checkSession()` call so any cookie-write race after hard-redirect sign-in is safely closed.
- Added missing `void` on async calls in event handlers.

See diff via `git show` on the fix commit.

## Verification

- Build compiles clean.
- No code outside `app/auth/callback/page.tsx` writes the legacy cookie; hook no longer reads it.
- `lib/auth/apiAuth.ts` already has a fallback that reads the `@supabase/ssr` `auth-token` cookies, so server routes keep working.
