import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

const uniqueSuffix = () => Date.now().toString().slice(-8);

test.describe('Core business flow smoke', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page);
    await ensureTenantCompany(page);
  });

  test('creates client, ticket, service line, and invoice PDF', async ({
    page,
  }) => {
    const clientName = `E2E Smoke Client ${uniqueSuffix()}`;
    const clientPhone = `961${uniqueSuffix().slice(-7)}`;

    await page.goto('/tickets/create');
    await expect(page.getByText('Información del cliente')).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'Nuevo cliente' }).click();
    const clientDialog = page.getByRole('dialog', {
      name: 'Crear nuevo cliente',
    });
    await expect(clientDialog).toBeVisible();
    await clientDialog.getByLabel('Nombre').fill(clientName);
    await clientDialog.getByLabel('Teléfono').fill(clientPhone);
    await clientDialog.getByRole('button', { name: 'Crear' }).click();
    const clientCreateError = page.getByText(/Error al crear el cliente|Selecciona una empresa/);
    await Promise.race([
      expect(page.getByText('Cliente seleccionado')).toBeVisible({
        timeout: 30_000,
      }),
      clientCreateError
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(async () => {
          throw new Error(
            `Client create failed: ${await clientCreateError.textContent()}`,
          );
        }),
    ]);
    await expect(clientDialog).toBeHidden({ timeout: 10_000 });
    await expect(
      page.getByRole('combobox', { name: 'Seleccionar cliente' }),
    ).toContainText(clientName);

    await page.getByRole('button', { name: 'Crear Ticket' }).click();
    await page.waitForURL(/\/tickets\/\d+\/services/, {
      timeout: 30_000,
    });

    const ticketId = page.url().match(/\/tickets\/(\d+)\/services/)?.[1];
    expect(ticketId).toBeTruthy();

    await page.getByRole('button', { name: 'Agregar servicio' }).click();
    const serviceDialog = page.getByRole('dialog', {
      name: 'Agregar servicio al ticket',
    });
    await expect(serviceDialog).toBeVisible();

    await serviceDialog.getByRole('combobox').click();
    const serviceListbox = page.getByRole('listbox');
    await expect(serviceListbox).toBeVisible({ timeout: 15_000 });
    const serviceOption = serviceListbox.getByRole('option').first();
    await expect(serviceOption).toBeVisible();
    const serviceName = (await serviceOption.textContent())?.trim();
    expect(serviceName).toBeTruthy();
    await serviceOption.click();

    await serviceDialog
      .getByRole('button', { name: 'Agregar al ticket' })
      .click();
    await expect(serviceDialog).toBeHidden({ timeout: 30_000 });
    await expect(
      page.getByRole('heading', { name: serviceName! }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Continuar a revisión' }).click();
    await page.waitForURL(
      new RegExp(`/tickets/${ticketId}/edit\\?step=review`),
      { timeout: 30_000 },
    );

    await expect(
      page.getByRole('button', { name: 'Guardar y generar PDF' }),
    ).toBeVisible();

    const finishButton = page.getByRole('button', {
      name: 'Guardar y generar PDF',
    });
    await finishButton.click();

    const schedulesDialog = page.getByRole('dialog', {
      name: 'Recordatorios de servicio',
    });
    await expect(schedulesDialog).toBeVisible({ timeout: 15_000 });
    await schedulesDialog.getByRole('button', { name: 'Omitir' }).click();

    await page.waitForURL(new RegExp(`/tickets/${ticketId}$`), {
      timeout: 60_000,
    });
    await expect(
      page.locator('[class*="bg-emerald"]').filter({ hasText: 'Finalizado' }),
    ).toBeVisible();

    const pdfCheck = await page.evaluate(async (id) => {
      const raw = localStorage.getItem('selectedCompany');
      const companyId = raw ? (JSON.parse(raw) as { id?: number }).id : null;
      const query = companyId ? `?company_id=${companyId}` : '';
      const response = await fetch(`/api/tickets/${id}/invoice${query}`, {
        cache: 'no-store',
      });
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      return {
        status: response.status,
        contentType: response.headers.get('content-type') ?? '',
        size: bytes.byteLength,
        magic: new TextDecoder().decode(bytes.subarray(0, 4)),
      };
    }, ticketId);

    expect(pdfCheck.status).toBe(200);
    expect(pdfCheck.contentType.toLowerCase()).toMatch(/pdf/);
    expect(pdfCheck.size).toBeGreaterThan(500);
    expect(pdfCheck.magic).toBe('%PDF');
  });
});
