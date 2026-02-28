# Steinz Labs

## Overview
Next.js 14 application using App Router, TypeScript, and Tailwind CSS. On-chain intelligence platform for crypto analytics.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom dark theme (Space Grotesk, Inter, JetBrains Mono fonts)
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod validation + @hookform/resolvers
- **Auth/Database**: Supabase (direct client via @supabase/supabase-js)
- **Blockchain**: Alchemy SDK
- **AI**: Anthropic AI SDK
- **Charts**: Recharts, Lightweight Charts
- **UI**: Lucide React icons, Framer Motion animations, Sonner toasts
- **Utilities**: clsx, tailwind-merge, class-variance-authority, date-fns, axios, crypto-js, sharp, image-hash, string-similarity

## Project Structure
```
app/                      # Next.js App Router pages and layouts
├── globals.css           # Global styles, fonts, glass/gradient utilities
├── layout.tsx            # Root layout
└── page.tsx              # Landing page (hero, stats, FAQ, pricing, footer)
lib/
└── supabase.ts           # Supabase client + admin (service role) client
```

## Design System
- **Background**: #0A0E1A (dark navy)
- **Card**: #111827, Elevated: #1A2235
- **Accent Colors**: Cyan (#00E5FF), Purple (#7C3AED)
- **Status**: Success (#10B981), Warning (#F59E0B), Danger (#EF4444)
- **Fonts**: Space Grotesk (headings), Inter (body), JetBrains Mono (code)
- **Utilities**: `.glass` (glassmorphism), `.gradient-text`, `.btn-gradient`, `.card-hover`

## Running
- **Dev**: `npm run dev` (port 5000)
- **Build**: `npm run build`
- **Start**: `npm run start` (port 5000)
- **Lint**: `npm run lint`

## Environment Variables
Configured in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase public config
- `SUPABASE_SERVICE_KEY` — Supabase service role (server-side only)
- `ALCHEMY_API_KEY` — Alchemy blockchain API
- `ANTHROPIC_API_KEY` — Anthropic AI
- `COINGECKO_API_KEY` — CoinGecko market data
- `LUNARCRUSH_KEY_1` through `LUNARCRUSH_KEY_4` — LunarCrush social metrics
- `HELIUS_KEY_1`, `HELIUS_KEY_2` — Helius Solana RPC

## Notes
- `image-hash` version updated from ^5.5.0 to ^7.0.1 (v5.x does not exist on npm)
- Project uses root-level `app/` and `lib/` directories (no `src/` prefix)
- `@/*` path alias maps to project root (`./`)
