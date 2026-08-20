import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

test.describe('Mobile offline field jobs (Epic B)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('offline create persists locally with Pendiente de subir', async ({
    page,
    context,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      'Offline field jobs validated on mobile viewport',
    );

    await page.goto('/anotar');
    // Prefer the card title — breadcrumb "Anotar trabajo" is hidden below md.
    await expect(page.getByText('Trabajo del día')).toBeVisible({
      timeout: 30_000,
    });

    const unique = `Offline Anotar ${Date.now()}`;
    const phone = `55${String(Date.now()).slice(-8)}`;

    // Create/select a client while online so Anotar has required name + phone.
    await page.getByRole('button', { name: 'Nuevo cliente' }).first().click();
    const clientDialog = page.getByRole('dialog', {
      name: 'Crear nuevo cliente',
    });
    await expect(clientDialog).toBeVisible();
    await clientDialog.getByLabel('Nombre').fill(unique);
    await clientDialog.getByLabel('Teléfono').fill(phone);
    await clientDialog.getByRole('button', { name: 'Crear' }).click();
    await expect(page.getByText('Cliente seleccionado')).toBeVisible({
      timeout: 30_000,
    });
    await expect(clientDialog).toBeHidden({ timeout: 10_000 });

    const notes = page.getByLabel(/Qué hice/i).first();
    await expect(notes).toBeVisible();
    await notes.fill('Trabajo offline de prueba');

    const total = page.getByLabel(/^Total$/i).first();
    await expect(total).toBeVisible();
    await total.fill('150');

    await context.setOffline(true);
    await expect(
      page.getByRole('status').filter({ hasText: /Sin conexión/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Sticky mobile CTA — avoid matching hidden desktop "Guardar trabajo".
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText(/Guardado en el teléfono/i)).toBeVisible({
      timeout: 15_000,
    });

    // Reconnect for navigation, but block mutations so auto-flush cannot clear
    // the pending badge before we assert it.
    await context.setOffline(false);
    await page.route('**/*', async (route) => {
      const request = route.request();
      const isMutation =
        request.method() !== 'GET' && request.method() !== 'HEAD';
      const isServerAction = Boolean(request.headers()['next-action']);
      if (isMutation || isServerAction) {
        await route.abort();
        return;
      }
      await route.continue();
    });

    await page.goto('/dashboard');
    await expect(page.getByTestId('technician-day-widget')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByTestId('technician-day-widget').scrollIntoViewIfNeeded();
    // Prefer Subir ahora — CardDescription can be clipped in the mobile header row.
    await expect(page.getByTestId('field-sync-now-button')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('field-sync-now-button')).toContainText(
      /Subir ahora/i,
    );
    await expect(
      page
        .getByTestId('technician-day-widget')
        .getByText('Pendiente de subir', { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
