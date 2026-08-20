import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

test.describe('Anotar online capture (Epic C)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('saves a finished job and shows Enviar success panel', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      'Anotar happy path validated on mobile viewport',
    );

    await page.goto('/anotar');
    await expect(page.getByText('Trabajo del día')).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole('combobox', { name: /Buscar cliente/i }),
    ).toBeVisible();

    const unique = `Anotar Online ${Date.now()}`;
    const phone = `55${String(Date.now()).slice(-8)}`;

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

    await page.getByLabel(/Qué hice/i).fill('Captura online de prueba');
    await page.getByLabel(/^Total$/i).fill('250');

    await page.getByRole('button', { name: 'Guardar', exact: true }).click();

    await expect(page.getByText(/Trabajo guardado correctamente|Listo/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      page.getByRole('button', { name: /Enviar|Recibo|WhatsApp|Listo/i }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /Creación completa/i })).toHaveCount(0);
  });
});
