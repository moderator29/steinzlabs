const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./i18n.ts');

let withSentryConfig = (config) => config;
try {
  const { withSentryConfig: sentryConfig } = require('@sentry/nextjs');
  withSentryConfig = (config) => sentryConfig(config, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  }, {
    widenClientFileUpload: true,
    transpileClientSDK: true,
    tunnelRoute: '/monitoring',
    hideSourceMaps: true,
    disableLogger: true,
  });
} catch { /* Sentry not installed yet */ }

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 16 dropped in-config eslint wiring — lint runs out-of-band.
  typescript: {
    // tsc --noEmit is clean today — fail the build on any new TS error
    // instead of silently shipping broken types.
    ignoreBuildErrors: false,
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'phvewrldcdxupsnakddx.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.coingecko.com',
      },
      {
        protocol: 'https',
        hostname: 'dd.dexscreener.com',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 3600,
  },
  redirects: async () => [
    { source: '/whitepaper', destination: '/docs', permanent: false },
  ],
  headers: async () => [
    // Global security headers — applied to every route. CSP is intentionally
    // permissive for now (script 'self' + 'unsafe-inline' + 'unsafe-eval'
    // because Next.js inlines hydration scripts and Sentry uses eval).
    // Tighten with nonces once the app moves to strict CSP.
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      ],
    },
    // Next 16 manages /_next/static/* cache headers itself.
    {
      source: '/api/auth/:path*',
      headers: [
        { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
        { key: 'Pragma', value: 'no-cache' },
      ],
    },
    {
      source: '/api/:path((?!auth).*)',
      headers: [
        { key: 'Cache-Control', value: 'public, s-maxage=10, stale-while-revalidate=30' },
      ],
    },
    {
      source: '/:path((?!_next|api).*)',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Pragma', value: 'no-cache' },
        { key: 'Expires', value: '0' },
      ],
    },
  ],
}

module.exports = withSentryConfig(withNextIntl(nextConfig))
