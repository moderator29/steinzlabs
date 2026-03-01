/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  images: {
    domains: ['hzzhgaxjlycqlopbvqxc.supabase.co'],
  },
  experimental: {
    optimizeCss: false,
  },
}

module.exports = nextConfig
