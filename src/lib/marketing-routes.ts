/**
 * Canonical public marketing paths for ZigZag.
 * Shared by proxy, robots, and sitemap so allowlists cannot drift.
 */

export const MARKETING_HOME_PATH = '/';
export const PRIVACY_PATH = '/aviso-de-privacidad';
export const TERMS_PATH = '/terminos-y-condiciones';
/** Help centre (ZIG-I40): guide index; every guide lives under `/ayuda/<slug>`. */
export const AYUDA_PATH = '/ayuda';
/**
 * Public guide for the MCP connector (ZIG-I40-5): the help centre's connector
 * page. OAuth metadata advertises it as service_documentation; it is public
 * through the /ayuda/ prefix.
 */
export const MCP_DOCS_PATH = `${AYUDA_PATH}/asistentes`;
/**
 * The connector guide's old address. Stays public (clients and old links may
 * hold it) until a later ticket redirects it to MCP_DOCS_PATH; not in the sitemap.
 */
export const LEGACY_MCP_DOCS_PATH = '/docs/mcp-connector';

/** Exact public marketing paths that guests may open without auth. */
export const PUBLIC_MARKETING_PATHS = [
  MARKETING_HOME_PATH,
  PRIVACY_PATH,
  TERMS_PATH,
  LEGACY_MCP_DOCS_PATH,
  AYUDA_PATH,
] as const;

export type PublicMarketingPath = (typeof PUBLIC_MARKETING_PATHS)[number];

/** Path prefixes whose whole subtree is public (the help guides). */
export const PUBLIC_MARKETING_PREFIXES = [`${AYUDA_PATH}/`] as const;

export const isPublicMarketingPath = (pathname: string): boolean => {
  return (
    (PUBLIC_MARKETING_PATHS as readonly string[]).includes(pathname) ||
    PUBLIC_MARKETING_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
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
  // The legacy guide duplicates /ayuda/asistentes (listed with the help pages).
  return PUBLIC_MARKETING_PATHS.filter((path) => path !== LEGACY_MCP_DOCS_PATH).map((path) => ({
    path,
    url: path === '/' ? `${origin}/` : `${origin}${path}`,
  }));
};

export const MARKETING_INDEXABLE_METADATA = {
  index: true,
  follow: true,
} as const;
