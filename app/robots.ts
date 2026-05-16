import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://nakalabs.xyz';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/about', '/pricing', '/docs', '/legal/'],
        disallow: [
          '/api/',
          '/dashboard/',
          '/admin/',
          '/onboarding/',
          '/auth/',
          '/_next/',
          '/monitoring/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
