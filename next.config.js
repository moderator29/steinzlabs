const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
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

module.exports = withNextIntl(nextConfig)
