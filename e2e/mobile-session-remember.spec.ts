import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  e2eEmail,
  e2ePassword,
  hasE2eCredentials,
} from './helpers/auth';

/**
 * ZIG-I17-7..9: "Mantener mi sesión" at login (8 hours vs 30 days) and the
 * sign-out-everywhere control in Mi cuenta. The sign-out itself is not clicked
 * here: it revokes every session of the shared e2e user and would break other
 * tests running in parallel (it is unit-tested).
 */

const HOUR = 60 * 60 * 1000;

const signIn = async (page: Page, remember: boolean) => {
  await page.context().clearCookies();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').waitFor({ state: 'visible', timeout: 30_000 });
  await page
    .waitForFunction(() => document.querySelector('form[data-hydrated="true"]') !== null, null, {
      timeout: 15_000,
    })
    .catch(() => undefined);
  await page.locator('#email').fill(e2eEmail!);
  await page.locator('#password').fill(e2ePassword!);
  if (remember) await page.getByLabel(/Mantener mi sesión/).check();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/callback/credentials') &&
        response.request().method() === 'POST',
      { timeout: 30_000 },
    ),
    page.getByRole('button', { name: 'Iniciar sesión' }).click(),
  ]);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
};

const sessionLifetimeMs = async (page: Page): Promise<number> => {
  const session = await page.evaluate(async () => {
    const response = await fetch('/api/auth/session');
    return response.json();
  });
  return new Date(session.expires).getTime() - Date.now();
};

test.describe('Remember this device', () => {
  test.beforeEach(() => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
  });

  test('a normal sign-in lasts 8 hours and Mi cuenta says so', async ({ page }) => {
    await signIn(page, false);
    const lifetime = await sessionLifetimeMs(page);
    expect(lifetime).toBeGreaterThan(7 * HOUR);
    expect(lifetime).toBeLessThanOrEqual(8 * HOUR + 60_000);

    await page.goto('/account');
    await expect(page.getByText('Tu sesión en este dispositivo dura hasta 8 horas.')).toBeVisible();
  });

  test('a remembered device lasts 30 days', async ({ page }) => {
    await signIn(page, true);
    const lifetime = await sessionLifetimeMs(page);
    expect(lifetime).toBeGreaterThan(29 * 24 * HOUR);
    expect(lifetime).toBeLessThanOrEqual(30 * 24 * HOUR + 60_000);

    await page.goto('/account');
    await expect(
      page.getByText('Este dispositivo mantiene tu sesión abierta hasta 30 días.'),
    ).toBeVisible();
  });

  test('sign out everywhere asks before it does anything', async ({ page }) => {
    await signIn(page, false);
    await page.goto('/account');
    await page.getByTestId('sign-out-everywhere').click();
    await expect(
      page.getByRole('alertdialog', { name: /Cerrar sesión en todos tus dispositivos/ }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(page).toHaveURL(/\/account/);
  });
});
