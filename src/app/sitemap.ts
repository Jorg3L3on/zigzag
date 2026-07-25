import type { MetadataRoute } from 'next';
import { getMarketingSitemapEntries } from '@/lib/marketing-routes';

/** Sitemap limited to public marketing + legal URLs. */
export default function sitemap(): MetadataRoute.Sitemap {
  return getMarketingSitemapEntries().map((entry) => ({
    url: entry.url,
    changeFrequency: entry.path === '/' ? 'weekly' : 'monthly',
    priority: entry.path === '/' ? 1 : 0.6,
  }));
}
