import { expect, type Locator, type Page } from '@playwright/test';

export const e2eEmail = process.env.E2E_EMAIL;
export const e2ePassword = process.env.E2E_PASSWORD;

export const hasE2eCredentials = Boolean(e2eEmail && e2ePassword);

export async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(e2eEmail!);
  await page.locator('#password').fill(e2ePassword!);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

export async function scrollPageDown(page: Page) {
  await page.evaluate(() => {
    const target = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      1200,
    );
    window.scrollTo(0, target);
  });
}

export async function expectPinnedNavWhileScrolling(
  page: Page,
  nav: Locator,
  expectedPosition: 'fixed' | 'sticky',
) {
  await expect(nav).toBeVisible();

  const position = await nav.evaluate(
    (el) => window.getComputedStyle(el).position,
  );
  expect(position).toBe(expectedPosition);

  const yBeforeScroll = (await nav.boundingBox())?.y ?? -1;
  await scrollPageDown(page);
  await expect(nav).toBeVisible();

  const yAfterScroll = (await nav.boundingBox())?.y ?? -1;
  expect(yAfterScroll).toBeLessThanOrEqual(yBeforeScroll + 2);
  expect(yAfterScroll).toBeGreaterThanOrEqual(0);
}
