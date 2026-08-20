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
    await expect(page.getByText(/Trabajo del día|Anotar/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await context.setOffline(true);

    const unique = `Offline Anotar ${Date.now()}`;
    // Prefer name field when no client selected — fill client name + phone
    const nameInput = page.getByLabel(/^Nombre/i).first();
    const phoneInput = page.getByLabel(/Teléfono/i).first();
    if (await nameInput.isVisible().catch(() => false)) {
      await nameInput.fill(unique);
    }
    if (await phoneInput.isVisible().catch(() => false)) {
      await phoneInput.fill('5512345678');
    }
    const notes = page.getByLabel(/Qué hice|Notas|trabajo/i).first();
    if (await notes.isVisible().catch(() => false)) {
      await notes.fill('Trabajo offline de prueba');
    }
    const total = page.getByLabel(/^Total/i).first();
    if (await total.isVisible().catch(() => false)) {
      await total.fill('150');
    }

    await page.getByRole('button', { name: /Guardar/i }).first().click();
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
  });
});
