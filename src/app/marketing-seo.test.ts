/**
 * @jest-environment node
 */
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { getWrittenGuides, guideHref } from '@/components/ayuda/guide-registry';
import {
  AYUDA_PATH,
  LEGACY_MCP_DOCS_PATH,
  MCP_DOCS_PATH,
  PRIVACY_PATH,
  TERMS_PATH,
} from '@/lib/marketing-routes';

describe('marketing SEO routes', () => {
  const originalAuthUrl = process.env.NEXTAUTH_URL;

  afterEach(() => {
    process.env.NEXTAUTH_URL = originalAuthUrl;
  });

  it('allows only marketing/legal paths and points to sitemap', () => {
    process.env.NEXTAUTH_URL = 'https://zigzag.example';
    const result = robots();

    expect(result.rules).toEqual({
      userAgent: '*',
      // /ayuda covers /ayuda/asistentes; the legacy guide stays allowed until it redirects.
      allow: ['/', PRIVACY_PATH, TERMS_PATH, LEGACY_MCP_DOCS_PATH, AYUDA_PATH],
      disallow: '/',
    });
    expect(result.sitemap).toBe('https://zigzag.example/sitemap.xml');
  });

  it('emits sitemap entries for the public URLs, each written help guide and the connector page', () => {
    process.env.NEXTAUTH_URL = 'https://zigzag.example';
    const entries = sitemap();
    const guideUrls = getWrittenGuides().map(
      (guide) => `https://zigzag.example${guideHref(guide.slug)}`,
    );

    expect(entries).toHaveLength(5 + guideUrls.length);
    expect(entries.map((entry) => entry.url)).toEqual([
      'https://zigzag.example/',
      `https://zigzag.example${PRIVACY_PATH}`,
      `https://zigzag.example${TERMS_PATH}`,
      'https://zigzag.example/ayuda',
      ...guideUrls,
      `https://zigzag.example${MCP_DOCS_PATH}`,
    ]);
    expect(entries.map((entry) => entry.url)).not.toContain(
      `https://zigzag.example${LEGACY_MCP_DOCS_PATH}`,
    );
  });
});
