# Critical flow 01 — Signup → onboarding → dashboard

**Persona**: fresh user, no prior account.

**Given** a clean browser session at `/` with no `naka-session` cookie set.

**When** the user clicks "Get Started" in the landing nav.
**Then** the signup form opens at `/signup` with email + password fields.

**When** the user submits a valid email + password.
**Then** the API returns 200, a `naka-session` cookie is set, and the
browser redirects to `/onboarding`.

**When** the onboarding gate mounts.
**Then** card 1 (welcome) is visible and `aria-label="Onboarding step 1 of 10"` matches.

**When** the user clicks "Next" ten times.
**Then** each card advances. On card 10 the CTA changes to "Finish"
and clicking it writes `profiles.onboarding_completed_at = now()` and
redirects to `/dashboard`.

**Then** `/dashboard` renders the user's empty portfolio surface and
the bottom nav shows the 5 primary actions.

**Cleanup**: drop the new user via `DELETE FROM auth.users WHERE email = '<test email>'`.

## Asserted invariants
- No console errors during the full flow.
- LCP < 1.5s on `/dashboard` cold load.
- `OnboardingGate` does not re-mount after `onboarding_completed_at` is set.
