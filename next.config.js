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
  eslint: {
    // ESLint config is currently broken (circular reference in @eslint/eslintrc).
    // Leaving ignore-on until the flat-config migration so builds aren't held
    // hostage by tooling we can't run.
    ignoreDuringBuilds: true,
  },
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
    {
      source: '/_next/static/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
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
