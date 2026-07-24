import type { MetadataRoute } from 'next';

/**
 * ZigZag is an auth-gated SaaS (login redirect for unauthenticated users).
 * Explicit noindex / disallow policy — no public marketing sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  };
}
