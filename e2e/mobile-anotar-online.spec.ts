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

    const nuevoCliente = page.getByRole('button', { name: 'Nuevo cliente' }).first();
    await expect(nuevoCliente).toBeVisible();
    await nuevoCliente.click();
    const clientDialog = page.getByRole('dialog', {
      name: 'Crear nuevo cliente',
    });
    await expect(clientDialog).toBeVisible({ timeout: 15_000 });
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

  test('Guardar without a client shows the message under the picker (ZIG-I18-4)', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Anotar is validated on mobile');

    await page.goto('/anotar');
    await expect(page.getByText('Trabajo del día')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText('Elige o crea un cliente para guardar')).toBeVisible();
  });

  test('a restored draft says so and Borrar clears it (ZIG-I18-4)', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Anotar is validated on mobile');

    await page.goto('/anotar');
    await expect(page.getByText('Trabajo del día')).toBeVisible({ timeout: 30_000 });
    await page.getByLabel(/^Total$/i).fill('480');
    await page.reload();
    const banner = page.getByTestId('anotar-draft-banner');
    await expect(banner).toContainText('Recuperamos lo que escribiste');
    await expect(page.getByLabel(/^Total$/i)).toHaveValue('480');
    await banner.getByRole('button', { name: 'Borrar' }).click();
    await expect(banner).toHaveCount(0);
    await expect(page.getByLabel(/^Total$/i)).toHaveValue('');
  });

  test('payment choices are at least 48 px tall and Volver goes to Hoy (ZIG-I18-4)', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'Anotar is validated on mobile');

    await page.goto('/anotar');
    await expect(page.getByText('Trabajo del día')).toBeVisible({ timeout: 30_000 });
    for (const name of ['Pagado', 'Parcial', 'Pendiente']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
    }
    await expect(page.getByRole('link', { name: 'Volver a Hoy' }).first()).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });
});
