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
 * The connector guide's old address. next.config redirects it to MCP_DOCS_PATH
 * (ZIG-I40-6); config redirects run before src/proxy.ts, so it needs no
 * public-path entry.
 */
export const LEGACY_MCP_DOCS_PATH = '/docs/mcp-connector';

/** Root of the retired static guides (public/guides, ZIG-I40-6). */
export const LEGACY_GUIDES_PATH = '/guides';

/**
 * Permanent redirects for retired public pages (ZIG-I40-6). next.config.ts
 * imports this list, so this module must keep no `@/` imports. The old guides
 * (index, guía para empresas, resumen ejecutivo and their assets) all land on
 * the help centre; the resumen ejecutivo has no replacement page.
 */
export const LEGACY_REDIRECTS = [
  { source: LEGACY_GUIDES_PATH, destination: AYUDA_PATH, permanent: true },
  // Next strips the trailing slash first (/guides/ → /guides → /ayuda, two
  // hops); the entry stays so the list names every old address.
  { source: `${LEGACY_GUIDES_PATH}/`, destination: AYUDA_PATH, permanent: true },
  { source: `${LEGACY_GUIDES_PATH}/index.html`, destination: AYUDA_PATH, permanent: true },
  { source: `${LEGACY_GUIDES_PATH}/guia-empresa.html`, destination: AYUDA_PATH, permanent: true },
  {
    source: `${LEGACY_GUIDES_PATH}/resumen-ejecutivo.html`,
    destination: AYUDA_PATH,
    permanent: true,
  },
  { source: `${LEGACY_GUIDES_PATH}/:path*`, destination: AYUDA_PATH, permanent: true },
  { source: LEGACY_MCP_DOCS_PATH, destination: MCP_DOCS_PATH, permanent: true },
] as const;

/** Exact public marketing paths that guests may open without auth. */
export const PUBLIC_MARKETING_PATHS = [
  MARKETING_HOME_PATH,
  PRIVACY_PATH,
  TERMS_PATH,
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
  return PUBLIC_MARKETING_PATHS.map((path) => ({
    path,
    url: path === '/' ? `${origin}/` : `${origin}${path}`,
  }));
};

export const MARKETING_INDEXABLE_METADATA = {
  index: true,
  follow: true,
} as const;
