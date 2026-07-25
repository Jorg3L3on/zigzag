import {
  getMarketingSitemapEntries,
  getMarketingSiteOrigin,
  isPublicMarketingPath,
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

  it('lists exactly the three public marketing paths', () => {
    expect(PUBLIC_MARKETING_PATHS).toEqual([
      '/',
      PRIVACY_PATH,
      TERMS_PATH,
    ]);
  });

  it('recognizes public marketing paths and rejects app routes', () => {
    expect(isPublicMarketingPath('/')).toBe(true);
    expect(isPublicMarketingPath(PRIVACY_PATH)).toBe(true);
    expect(isPublicMarketingPath(TERMS_PATH)).toBe(true);
    expect(isPublicMarketingPath('/dashboard')).toBe(false);
    expect(isPublicMarketingPath('/tickets')).toBe(false);
    expect(isPublicMarketingPath('/aviso-de-privacidad/extra')).toBe(false);
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
    ]);
  });
});
