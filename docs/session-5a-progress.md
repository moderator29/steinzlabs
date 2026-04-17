# Session 5A Progress

Branch: `session-5a-production`

## Phase 1 — Brand Migration (IN PROGRESS)

- [x] Branding assets copied from `/public/branding/` to `/public/` and `/public/icons/`
- [x] `manifest.json` created with Naka Labs identity
- [x] Root `app/layout.tsx` metadata updated to Naka Labs
- [x] Brand components: `components/brand/Logo.tsx`, `AgentAvatar.tsx`, `NakaLoader.tsx`
- [x] Canonical `components/ui/SteinzLogo.tsx` now renders `/logo.png` (propagates to every consumer including `SteinzLogoSpinner`)
- [x] Global text replacement: "Steinz Labs" → "Naka Labs", "STEINZ LABS" → "NAKA LABS", "@steinzlabs" → "@nakalabs", "steinzlabs.com" → "nakalabs.com"
- [x] Standalone `Steinz` word replaced in VTX route, community/dna/vtx-ai pages, notifications

Internal identifiers (file paths, package name, CSS vars `--steinz-*`, env vars `STEINZ_*`, Supabase tables) intentionally unchanged to avoid breaking deployment, per prompt rules.
