import { test, expect } from '@playwright/test';

const adminEmail = process.env.E2E_EMAIL;
const adminPassword = process.env.E2E_PASSWORD;
const viewerEmail = process.env.E2E_VIEWER_EMAIL ?? 'viewer@test.com';
const viewerPassword = process.env.E2E_VIEWER_PASSWORD ?? process.env.E2E_PASSWORD;

const login = async (
  page: import('@playwright/test').Page,
  email: string,
  password: string,
) => {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
};

test.describe('Audit log access', () => {
  test('system admin can open audit page', async ({ page }) => {
    test.skip(!adminEmail || !adminPassword, 'Set E2E_EMAIL and E2E_PASSWORD');

    await login(page, adminEmail!, adminPassword!);
    await page.goto('/dashboard/audit');
    await expect(page.getByRole('heading', { name: 'Auditoría' })).toBeVisible();
    await expect(page.getByText('Eventos de auditoría')).toBeVisible();
  });

  test('non-system viewer is forbidden on audit page', async ({ page }) => {
    test.skip(!viewerPassword, 'Set E2E_VIEWER_PASSWORD or E2E_PASSWORD');

    await login(page, viewerEmail, viewerPassword!);
    await page.goto('/dashboard/audit');
    await expect(page).toHaveURL(/\/dashboard\/forbidden/);
  });
});
