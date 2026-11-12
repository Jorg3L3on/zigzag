import {
  AYUDA_PATH,
  getMarketingSitemapEntries,
  getMarketingSiteOrigin,
  isPublicMarketingPath,
  LEGACY_GUIDES_PATH,
  LEGACY_MCP_DOCS_PATH,
  LEGACY_REDIRECTS,
  MCP_DOCS_PATH,
  PRIVACY_PATH,
  PUBLIC_MARKETING_PATHS,
  TERMS_PATH,
} from '@/lib/marketing-routes';

describe('marketing-routes', () => {
  const originalAuthUrl = process.env.NEXTAUTH_URL;
  const originalVercelUrl = process.env.VERCEL_URL;

  afterEach(() => {
    process.env.NEXTAUTH_URL = originalAuthUrl;
    process.env.VERCEL_URL = originalVercelUrl;
  });

  it('lists exactly the four public paths (marketing, legal and help)', () => {
    expect(PUBLIC_MARKETING_PATHS).toEqual(['/', PRIVACY_PATH, TERMS_PATH, AYUDA_PATH]);
    expect(MCP_DOCS_PATH).toBe('/ayuda/asistentes');
    expect(LEGACY_MCP_DOCS_PATH).toBe('/docs/mcp-connector');
    expect(AYUDA_PATH).toBe('/ayuda');
  });

  it('treats every /ayuda/<slug> guide as public, but not look-alike paths', () => {
    expect(isPublicMarketingPath('/ayuda')).toBe(true);
    expect(isPublicMarketingPath('/ayuda/crear-un-ticket')).toBe(true);
    expect(isPublicMarketingPath('/ayuda/asistentes')).toBe(true);
    expect(isPublicMarketingPath('/ayudante')).toBe(false);
    expect(isPublicMarketingPath('/tickets/ayuda')).toBe(false);
  });

  it('recognizes public marketing paths and rejects app routes', () => {
    expect(isPublicMarketingPath('/')).toBe(true);
    expect(isPublicMarketingPath(PRIVACY_PATH)).toBe(true);
    expect(isPublicMarketingPath(TERMS_PATH)).toBe(true);
    expect(isPublicMarketingPath(MCP_DOCS_PATH)).toBe(true);
    // Redirected by next.config before the proxy runs (ZIG-I40-6).
    expect(isPublicMarketingPath(LEGACY_MCP_DOCS_PATH)).toBe(false);
    expect(isPublicMarketingPath('/dashboard')).toBe(false);
    expect(isPublicMarketingPath('/tickets')).toBe(false);
    expect(isPublicMarketingPath('/aviso-de-privacidad/extra')).toBe(false);
  });

  it('redirects the retired guides to /ayuda and the old connector guide to /ayuda/asistentes', () => {
    expect(LEGACY_GUIDES_PATH).toBe('/guides');
    expect(LEGACY_REDIRECTS).toEqual([
      { source: '/guides', destination: '/ayuda', permanent: true },
      { source: '/guides/', destination: '/ayuda', permanent: true },
      { source: '/guides/index.html', destination: '/ayuda', permanent: true },
      { source: '/guides/guia-empresa.html', destination: '/ayuda', permanent: true },
      { source: '/guides/resumen-ejecutivo.html', destination: '/ayuda', permanent: true },
      { source: '/guides/:path*', destination: '/ayuda', permanent: true },
      { source: '/docs/mcp-connector', destination: '/ayuda/asistentes', permanent: true },
    ]);
  });

  it('builds sitemap entries from NEXTAUTH_URL', () => {
    process.env.NEXTAUTH_URL = 'https://zigzag.example';
    delete process.env.VERCEL_URL;

    expect(getMarketingSiteOrigin()).toBe('https://zigzag.example');
    expect(getMarketingSitemapEntries()).toEqual([
      { path: '/', url: 'https://zigzag.example/' },
      {
        path: PRIVACY_PATH,
        url: `https://zigzag.example${PRIVACY_PATH}`,
      },
      {
        path: TERMS_PATH,
        url: `https://zigzag.example${TERMS_PATH}`,
      },
      { path: AYUDA_PATH, url: 'https://zigzag.example/ayuda' },
    ]);
  });
});
