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

test.describe('RBAC browser specs', () => {
  test('viewer cannot see ticket create CTA @390px', async ({ page }) => {
    test.skip(!viewerPassword, 'Set E2E_VIEWER_PASSWORD or E2E_PASSWORD');

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, viewerEmail, viewerPassword!);
    await page.goto('/dashboard/tickets');
    await expect(page.getByRole('link', { name: 'Nuevo ticket' })).toHaveCount(0);
  });

  test('admin sees ticket create CTA @768px', async ({ page }) => {
    test.skip(!adminEmail || !adminPassword, 'Set E2E_EMAIL and E2E_PASSWORD');

    await page.setViewportSize({ width: 768, height: 900 });
    await login(page, adminEmail!, adminPassword!);
    await page.goto('/dashboard/tickets');
    await expect(page.getByRole('link', { name: 'Nuevo ticket' })).toBeVisible();
  });

  test('viewer ticket detail hides edit action', async ({ page }) => {
    test.skip(!viewerPassword, 'Set E2E_VIEWER_PASSWORD or E2E_PASSWORD');

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, viewerEmail, viewerPassword!);
    await page.goto('/dashboard/tickets');

    const firstTicket = page.getByRole('button', { name: /Ticket/i }).first();
    if ((await firstTicket.count()) === 0) {
      test.skip(true, 'No tickets in seed for viewer company');
    }

    await firstTicket.click();
    await expect(page.getByRole('link', { name: 'Editar Ticket' })).toHaveCount(0);
  });

  test('viewer clients list hides new client CTA', async ({ page }) => {
    test.skip(!viewerPassword, 'Set E2E_VIEWER_PASSWORD or E2E_PASSWORD');

    await page.setViewportSize({ width: 768, height: 900 });
    await login(page, viewerEmail, viewerPassword!);
    await page.goto('/dashboard/clients');
    await expect(page.getByRole('link', { name: /Nuevo cliente/i })).toHaveCount(0);
  });
});
