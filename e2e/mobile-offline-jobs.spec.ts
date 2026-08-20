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

    await page.goto('/tickets/create');
    await expect(page.getByLabel(/Nombre/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await context.setOffline(true);

    const unique = `Offline ${Date.now()}`;
    await page.getByLabel(/Nombre/i).first().fill(unique);
    await page.getByLabel(/Teléfono/i).first().fill('5512345678');

    const dateTrigger = page.getByRole('button', { name: /fecha|Selecciona/i }).first();
    if (await dateTrigger.isVisible().catch(() => false)) {
      // ticket_date may already have a default
    }

    await page.getByRole('button', { name: /Crear|Guardar/i }).first().click();
    await expect(page.getByText(/Guardado en el teléfono/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.goto('/dashboard');
    await expect(page.getByTestId('technician-day-widget')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Pendiente de subir/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(unique).first()).toBeVisible();

    await context.setOffline(false);
    const syncButton = page.getByTestId('field-sync-now-button');
    if (await syncButton.isVisible().catch(() => false)) {
      await syncButton.click();
    }
  });
});
