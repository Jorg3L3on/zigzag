import type { MetadataRoute } from 'next';
import {
  ASSISTANT_PAGE_PATH,
  ASSISTANT_PAGE_READY,
  getWrittenGuides,
  guideHref,
} from '@/components/ayuda/guide-registry';
import { getMarketingSiteOrigin, getMarketingSitemapEntries } from '@/lib/marketing-routes';

/** Sitemap limited to public marketing + legal URLs, /ayuda, each written guide and the connector page once it exists. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getMarketingSiteOrigin();
  return [
    ...getMarketingSitemapEntries().map((entry) => ({
      url: entry.url,
      changeFrequency: entry.path === '/' ? ('weekly' as const) : ('monthly' as const),
      priority: entry.path === '/' ? 1 : 0.6,
    })),
    ...getWrittenGuides().map((guide) => ({
      url: `${origin}${guideHref(guide.slug)}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...(ASSISTANT_PAGE_READY
      ? [{ url: `${origin}${ASSISTANT_PAGE_PATH}`, changeFrequency: 'monthly' as const, priority: 0.5 }]
      : []),
  ];
}
