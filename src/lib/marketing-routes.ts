/**
 * Canonical public marketing paths for ZigZag.
 * Shared by proxy, robots, and sitemap so allowlists cannot drift.
 */

export const MARKETING_HOME_PATH = '/';
export const PRIVACY_PATH = '/aviso-de-privacidad';
export const TERMS_PATH = '/terminos-y-condiciones';

/** Exact public marketing paths that guests may open without auth. */
export const PUBLIC_MARKETING_PATHS = [
  MARKETING_HOME_PATH,
  PRIVACY_PATH,
  TERMS_PATH,
] as const;

export type PublicMarketingPath = (typeof PUBLIC_MARKETING_PATHS)[number];

export const isPublicMarketingPath = (pathname: string): boolean => {
  return (PUBLIC_MARKETING_PATHS as readonly string[]).includes(pathname);
};

/**
 * Absolute origin for sitemap/OG. Prefers NEXTAUTH_URL, then Vercel URL.
 */
export const getMarketingSiteOrigin = (): string => {
  const fromAuth = process.env.NEXTAUTH_URL?.replace(/\/$/, '');
  if (fromAuth) {
    return fromAuth;
  }

  const vercel = process.env.VERCEL_URL?.replace(/\/$/, '');
  if (vercel) {
    return vercel.startsWith('http') ? vercel : `https://${vercel}`;
  }

  return 'http://localhost:3069';
};

export const getMarketingSitemapEntries = (): Array<{
  url: string;
  path: PublicMarketingPath;
}> => {
  const origin = getMarketingSiteOrigin();
  return PUBLIC_MARKETING_PATHS.map((path) => ({
    path,
    url: path === '/' ? `${origin}/` : `${origin}${path}`,
  }));
};

export const MARKETING_INDEXABLE_METADATA = {
  index: true,
  follow: true,
} as const;
