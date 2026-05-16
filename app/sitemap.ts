import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://nakalabs.xyz';
  const now = new Date();

  const staticRoutes: Array<{ path: string; priority: number; frequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    { path: '', priority: 1.0, frequency: 'weekly' },
    { path: '/about', priority: 0.7, frequency: 'monthly' },
    { path: '/pricing', priority: 0.9, frequency: 'weekly' },
    { path: '/docs', priority: 0.7, frequency: 'weekly' },
    { path: '/legal/terms', priority: 0.3, frequency: 'yearly' },
    { path: '/legal/privacy', priority: 0.3, frequency: 'yearly' },
    { path: '/legal/risk', priority: 0.3, frequency: 'yearly' },
  ];

  return staticRoutes.map(({ path, priority, frequency }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: frequency,
    priority,
  }));
}
