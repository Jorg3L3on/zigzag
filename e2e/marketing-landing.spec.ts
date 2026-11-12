import { test, expect } from '@playwright/test';
import { PRIVACY_PATH, TERMS_PATH } from '../src/lib/marketing-routes';
import {
  e2eCredentialsSkipReason,
  hasE2eCredentials,
  login,
} from './helpers/auth';

/** The hero h1 is three block lines; its accessible name joins them with spaces. */
const HERO_HEADLINE = /^Haz el trabajo\.\s*Manda el recibo\.\s*Cobra completo\.$/;

test.describe('Public marketing landing', () => {
  test('guests can open / without login redirect', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { level: 1, name: HERO_HEADLINE }),
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

  test('hero "Pedir acceso" goes to the access request form', async ({
    page,
  }) => {
    await page.goto('/');

    await page
      .getByRole('main')
      .getByRole('link', { name: 'Pedir acceso' })
      .first()
      .click();
    await expect(page).toHaveURL(/\/#acceso$/);
    await expect(
      page.getByRole('form', { name: 'Solicitud de acceso' }),
    ).toBeInViewport({ ratio: 0.2 });
  });

  test('top bar "Pedir acceso" points at the form and "Entrar" goes to login', async ({
    page,
  }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Principal' });

    await expect(nav.getByRole('link', { name: 'Pedir acceso' })).toHaveAttribute(
      'href',
      '#acceso',
    );

    await nav.getByRole('link', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('footer legal links work', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('navigation', { name: 'Pie de página' });

    await footer.getByRole('link', { name: 'Aviso de privacidad' }).click();
    await expect(page).toHaveURL(new RegExp(`${PRIVACY_PATH}$`));
    await expect(
      page.getByRole('heading', { level: 1, name: 'Aviso de privacidad' }),
    ).toBeVisible();

    await page.goto('/');
    await footer.getByRole('link', { name: 'Términos y condiciones' }).click();
    await expect(page).toHaveURL(new RegExp(`${TERMS_PATH}$`));
    await expect(
      page.getByRole('heading', { level: 1, name: 'Términos y condiciones' }),
    ).toBeVisible();
  });

  test('signed-in users opening / go to the dashboard', async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);

    await login(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
