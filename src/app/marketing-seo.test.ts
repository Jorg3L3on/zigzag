/**
 * @jest-environment node
 */
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { getWrittenGuides, guideHref } from '@/components/ayuda/guide-registry';
import {
  AYUDA_PATH,
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
      allow: ['/', PRIVACY_PATH, TERMS_PATH, MCP_DOCS_PATH, AYUDA_PATH],
      disallow: '/',
    });
    expect(result.sitemap).toBe('https://zigzag.example/sitemap.xml');
  });

  it('emits sitemap entries for the five public URLs plus each written help guide', () => {
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
      `https://zigzag.example${MCP_DOCS_PATH}`,
      'https://zigzag.example/ayuda',
      ...guideUrls,
    ]);
  });
});
