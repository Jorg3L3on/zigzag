/**
 * @jest-environment node
 */
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import {
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
      allow: ['/', PRIVACY_PATH, TERMS_PATH, MCP_DOCS_PATH],
      disallow: '/',
    });
    expect(result.sitemap).toBe('https://zigzag.example/sitemap.xml');
  });

  it('emits sitemap entries for exactly the four public URLs', () => {
    process.env.NEXTAUTH_URL = 'https://zigzag.example';
    const entries = sitemap();

    expect(entries).toHaveLength(4);
    expect(entries.map((entry) => entry.url)).toEqual([
      'https://zigzag.example/',
      `https://zigzag.example${PRIVACY_PATH}`,
      `https://zigzag.example${TERMS_PATH}`,
      `https://zigzag.example${MCP_DOCS_PATH}`,
    ]);
  });
});
