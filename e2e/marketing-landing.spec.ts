import { test, expect } from '@playwright/test';
import { LANDING_HERO } from '../src/components/marketing/marketing-landing-content';
import { PRIVACY_PATH, TERMS_PATH } from '../src/lib/marketing-routes';

test.describe('Public marketing landing', () => {
  test('guests can open / without login redirect', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { level: 1, name: LANDING_HERO.headline }),
    ).toBeVisible();
  });

  test('guests can open legal marketing paths', async ({ page }) => {
    await page.goto(PRIVACY_PATH);
    await expect(page).toHaveURL(new RegExp(`${PRIVACY_PATH}$`));
    await expect(
      page.getByRole('heading', { level: 1, name: 'Aviso de privacidad' }),
    ).toBeVisible();

    await page.goto(TERMS_PATH);
    await expect(page).toHaveURL(new RegExp(`${TERMS_PATH}$`));
    await expect(
      page.getByRole('heading', { level: 1, name: 'Términos y condiciones' }),
    ).toBeVisible();
  });

  test('unauthenticated protected app routes still redirect to login', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/tickets');
    await expect(page).toHaveURL(/\/login/);
  });

  test('landing primary CTA goes to login and footer legal links work', async ({
    page,
  }) => {
    await page.goto('/');

    await page
      .getByRole('link', { name: 'Iniciar sesión' })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/');
    await page.getByRole('link', { name: 'Aviso de privacidad' }).click();
    await expect(page).toHaveURL(new RegExp(`${PRIVACY_PATH}$`));
    await expect(
      page.getByRole('heading', { level: 1, name: 'Aviso de privacidad' }),
    ).toBeVisible();
  });
});
