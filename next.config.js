/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['hzzhgaxjlycqlopbvqxc.supabase.co'],
  },
  experimental: {
    serverActions: true,
  },
}

module.exports = nextConfig
