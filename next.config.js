/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    domains: ['hzzhgaxjlycqlopbvqxc.supabase.co'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 3600,
  },
  transpilePackages: ['styled-jsx'],
  compiler: {
    styledJsx: true,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'styled-jsx': require.resolve('styled-jsx'),
        'styled-jsx/style': require.resolve('styled-jsx/style'),
      };
    }
    return config;
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: process.env.NODE_ENV !== 'production'
        ? [
            { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' },
            { key: 'Pragma', value: 'no-cache' },
            { key: 'Expires', value: '0' },
          ]
        : [],
    },
    {
      source: '/api/auth/:path*',
      headers: [
        { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
      ],
    },
    {
      source: '/api/:path((?!auth).*)',
      headers: [
        { key: 'Cache-Control', value: 'public, s-maxage=10, stale-while-revalidate=30' },
      ],
    },
    {
      source: '/_next/static/:path*',
      headers: process.env.NODE_ENV === 'production'
        ? [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]
        : [{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, max-age=0' }],
    },
  ],
}

module.exports = nextConfig
