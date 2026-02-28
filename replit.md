# Steinz Labs

## Overview
Next.js 14 application using App Router, TypeScript, and Tailwind CSS.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with CSS variable-based theming
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod validation + @hookform/resolvers
- **Auth/Database**: Supabase (@supabase/auth-helpers-nextjs)
- **Blockchain**: Alchemy SDK
- **AI**: Anthropic AI SDK
- **Charts**: Recharts, Lightweight Charts
- **UI**: Lucide React icons, Framer Motion animations, Sonner toasts
- **Utilities**: clsx, tailwind-merge, class-variance-authority, date-fns, axios, crypto-js, sharp, image-hash, string-similarity

## Project Structure
```
src/
├── app/                  # Next.js App Router pages and layouts
│   ├── api/              # API route handlers
│   │   └── health/       # Health check endpoint
│   ├── globals.css       # Global styles and CSS variables
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/           # Reusable React components
│   └── ui/               # Base UI components
├── hooks/                # Custom React hooks
├── lib/                  # Shared utilities and configurations
│   ├── supabase/         # Supabase client/server helpers
│   └── utils.ts          # cn() utility for className merging
├── stores/               # Zustand state stores
└── types/                # TypeScript type definitions
```

## Running
- **Dev**: `npm run dev` (port 5000)
- **Build**: `npm run build`
- **Start**: `npm run start` (port 5000)
- **Lint**: `npm run lint`

## Notes
- `image-hash` version updated from ^5.5.0 to ^7.0.1 (v5.x does not exist on npm)
- Supabase auth-helpers-nextjs is deprecated; consider migrating to @supabase/ssr in the future
- Tailwind config uses CSS variable-based theming compatible with shadcn/ui patterns
