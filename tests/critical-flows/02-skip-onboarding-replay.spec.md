# Critical flow 02 — Skip onboarding → replay from Settings

**Persona**: fresh user.

**Given** a fresh session at `/onboarding` card 1.

**When** the user clicks "Skip tour".
**Then** the confirmation modal opens with copy from `onboarding.skipConfirm`.

**When** the user confirms "Skip anyway".
**Then** the API writes `onboarding_completed_at = now()` and redirects to `/dashboard`.

**When** the user navigates to `/settings`.
**Then** the "Replay onboarding" button is visible in the Account
section.

**When** the user clicks it.
**Then** the API nulls `onboarding_completed_at` and the OnboardingGate
remounts at card 1 on next navigation.

## Asserted invariants
- `profiles.onboarding_completed_at` round-trips null → ISO → null.
- Skip → Replay → Complete leaves no leaked state in `localStorage` or
  `onboarding_events` (event log keeps the skip + finish rows).
