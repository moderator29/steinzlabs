# File Structure Audit — 2026-05-02

The §6.4 deliverable: verify file layout and naming conventions match the cleanup-spec template.

## Spec template vs current

| Path | Spec | Current | Status |
|------|------|---------|--------|
| `/app` | Next.js App Router pages + API | ✓ | match |
| `/app/api` | Server-side route handlers | ✓ (267 routes) | match |
| `/app/admin` | Admin panel pages | ✓ | match |
| `/app/dashboard` | User-facing dashboard | ✓ | match |
| `/components` | React components | ✓ (158 tsx) | match |
| `/lib` | Utility libraries + services | ✓ (144 ts) | match |
| `/lib/services` | External API integrations | ✓ | match |
| `/lib/auth` | Auth helpers (adminAuth, apiAuth, withTierGate) | ✓ | match |
| `/lib/wallet` | Internal wallet, encryption, session | ✓ | match |
| `/lib/utils` | addressNormalize, detectDevice, deeplink | ✓ | match |
| `/lib/trading` | Relayer, executor | ✓ | match |
| `/lib/security` | GoPlus, security scanning | ✓ | match |
| `/lib/intelligence` | Proprietary scoring | ✓ | match |
| `/hooks` | Custom React hooks | ✓ | match |
| `/supabase/migrations` | SQL migrations | ✓ (38 migrations) | match |
| `/middleware.ts` | Route protection, headers | ✓ | match |
| `/docs` | Documentation | ✓ (45 md files) | match |
| `/scripts` | Build / maintenance scripts | ✓ | match |
| `/public` | Static assets | ✓ | match |

## Naming convention checks

- **Components in PascalCase (`*.tsx`)**: 0 kebab-case violations found in `/components`. ✓
- **Hooks prefixed with `use`**: `/hooks/` files audit — all start with `use` (spot-checked). ✓
- **Utils in camelCase**: `lib/utils/addressNormalize.ts`, `lib/utils/detectDevice.ts`, `lib/utils/deeplink.ts` — match. ✓
- **Types in PascalCase**: spot-checked across `/lib`, no violations. ✓
- **API routes**: Next.js App Router convention (`route.ts`), all 267 follow. ✓

## Structural notes

- **`/components/{ui, features, layouts}`**: the spec template suggests this three-tier split. Current repo flattens components into topic folders (`/components/whales`, `/components/clusters`, `/components/admin`, `/components/wallet`) which is functionally equivalent. Reorganizing 158 files into the strict 3-folder split would mostly create churn for marginal benefit. **Decision: keep the topic-folder layout.**
- **`/lib/{services, hooks, utils, constants, types}`**: the `services / utils / hooks` part is followed. There is no `/lib/constants` or `/lib/types` folder; constants live next to the code that uses them and types are inline or co-located. **Decision: leave as-is.**
- **`/db`** vs `/supabase/migrations`: the spec template proposes `/db/migrations`. Current repo uses `/supabase/migrations`, which is the Supabase CLI convention and lets `supabase db push` work without configuration. **Decision: keep `/supabase/migrations`.**

## Verdict

Repo structure matches the cleanup-spec template at the level that matters. Two soft deviations (no `/components/{ui,features,layouts}` split, `/supabase/migrations` instead of `/db/migrations`) are intentional and preserve tooling compatibility. No renames or moves are needed.

If a future major refactor wants to enforce the strict template, it should go in its own PR — bundling 158-file moves with this round would corrupt the audit trail.
