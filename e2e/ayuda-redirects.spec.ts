import { test, expect } from '@playwright/test';

/**
 * ZIG-I40-6: the static /guides pages and the old connector guide are gone;
 * their addresses answer 308 and land guests on the help centre, never /login.
 */
const OLD_GUIDES = [
  '/guides',
  '/guides/index.html',
  '/guides/guia-empresa.html',
  '/guides/resumen-ejecutivo.html',
  '/guides/images/empresa/01-dashboard.webp',
];

test.describe('Retired help addresses redirect (ZIG-I40-6)', () => {
  for (const path of OLD_GUIDES) {
    test(`${path} answers 308 to /ayuda`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe('/ayuda');
    });
  }

  test('/guides/ drops the slash, then lands on /ayuda', async ({ request }) => {
    const first = await request.get('/guides/', { maxRedirects: 0 });
    expect(first.status()).toBe(308);
    const second = await request.get(first.headers().location, { maxRedirects: 0 });
    expect(second.status()).toBe(308);
    expect(second.headers().location).toBe('/ayuda');
  });

  test('/docs/mcp-connector answers 308 to /ayuda/asistentes', async ({ request }) => {
    const response = await request.get('/docs/mcp-connector', { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe('/ayuda/asistentes');
  });

  for (const path of ['/guides/', '/guides/guia-empresa.html', '/guides/resumen-ejecutivo.html']) {
    test(`a guest opening ${path} sees the help centre`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/ayuda$/);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  }

  test('a guest opening /docs/mcp-connector sees the connector guide', async ({ page }) => {
    await page.goto('/docs/mcp-connector');
    await expect(page).toHaveURL(/\/ayuda\/asistentes$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
