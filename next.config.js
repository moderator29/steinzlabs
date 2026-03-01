/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: false,
  images: {
    domains: ['hzzhgaxjlycqlopbvqxc.supabase.co'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 3600,
  },
  experimental: {
    optimizeCss: false,
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts'],
  },
  headers: async () => [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, s-maxage=10, stale-while-revalidate=30' },
      ],
    },
    {
      source: '/_next/static/:path*',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
  ],
}

module.exports = nextConfig
