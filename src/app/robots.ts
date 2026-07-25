import type { MetadataRoute } from 'next';
import {
  getMarketingSiteOrigin,
  PUBLIC_MARKETING_PATHS,
} from '@/lib/marketing-routes';

/**
 * Allow indexing only for public marketing/legal paths.
 * App surfaces remain disallowed via blanket disallow with explicit allows.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: [...PUBLIC_MARKETING_PATHS],
      disallow: '/',
    },
    sitemap: `${getMarketingSiteOrigin()}/sitemap.xml`,
  };
}
