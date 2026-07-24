import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import { formatServiceCurrency } from '../src/components/tickets/ticket-services-utils';

const uniqueSuffix = () => Date.now().toString().slice(-8);

const UNIT_PRICE = 100;
const INITIAL_QUANTITY = 2;
const UPDATED_QUANTITY = 3;
const PARTIAL_PAYMENT = 50;

const createClientAndTicket = async (page: Page) => {
  const clientName = `Mobile E2E Client ${uniqueSuffix()}`;
  const clientPhone = `961${uniqueSuffix().slice(-7)}`;

  await page.goto('/tickets/create');
  await expect(page.getByText('Información del cliente').first()).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole('button', { name: 'Nuevo cliente' }).first().click();
  const clientDialog = page.getByRole('dialog', {
    name: 'Crear nuevo cliente',
  });
  await expect(clientDialog).toBeVisible();
  await clientDialog.getByLabel('Nombre').fill(clientName);
  await clientDialog.getByLabel('Teléfono').fill(clientPhone);
  await clientDialog.getByRole('button', { name: 'Crear' }).click();

  const clientCreateError = page.getByText(
    /Error al crear el cliente|Selecciona una empresa/,
  );
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

  // Mobile sticky bar uses "Crear"; desktop submit is hidden below md.
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await page.waitForURL(/\/tickets\/\d+\/services/, { timeout: 30_000 });

  const ticketId = page.url().match(/\/tickets\/(\d+)\/services/)?.[1];
  expect(ticketId).toBeTruthy();
  return { ticketId: ticketId!, clientName };
};

const addServiceWithPrice = async (
  page: Page,
  {
    quantity,
    price,
  }: {
    quantity: number;
    price: number;
  },
) => {
  await page.getByRole('button', { name: 'Agregar servicio' }).click();
  const serviceDialog = page.getByRole('dialog', {
    name: 'Agregar servicio al ticket',
  });
  await expect(serviceDialog).toBeVisible();

  await serviceDialog.getByRole('combobox', { name: 'Servicio' }).click();
  const serviceListbox = page.getByRole('listbox');
  await expect(serviceListbox).toBeVisible({ timeout: 15_000 });
  const serviceOption = serviceListbox.getByRole('option').first();
  await expect(serviceOption).toBeVisible();
  const serviceName = (await serviceOption.textContent())?.trim();
  expect(serviceName).toBeTruthy();
  await serviceOption.click();

  await serviceDialog.getByLabel('Cantidad').fill(String(quantity));
  await serviceDialog.getByLabel('Precio').fill(String(price));
  await serviceDialog
    .getByRole('button', { name: 'Agregar al ticket' })
    .click();
  await expect(serviceDialog).toBeHidden({ timeout: 30_000 });
  await expect(
    page.getByRole('heading', { name: serviceName! }),
  ).toBeVisible();

  return serviceName!;
};

const expectServicesTotal = async (page: Page, amount: number) => {
  const formatted = formatServiceCurrency(amount);
  await expect(
    page
      .locator('div')
      .filter({ has: page.getByText('Total', { exact: true }) })
      .getByText(formatted, { exact: true })
      .first(),
  ).toBeVisible();
};

const finishWithPartialPayment = async (
  page: Page,
  ticketId: string,
  partialAmount: number,
) => {
  await page.getByRole('button', { name: 'Continuar a revisión' }).click();
  await page.waitForURL(
    new RegExp(`/tickets/${ticketId}/edit\\?step=review`),
    { timeout: 30_000 },
  );

  await page.getByRole('button', { name: 'Pago parcial' }).click();
  await page.locator('#paid-amount').fill(String(partialAmount));

  await page.getByRole('button', { name: 'Guardar y generar PDF' }).click();

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
  await expect(page.getByText('Pago parcial').first()).toBeVisible();
};

const settleRemainingBalance = async (page: Page) => {
  const paymentsSection = page.locator('#cobranza');
  await paymentsSection.scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('button', { name: 'Saldar el ticket por completo' }),
  ).toBeVisible({ timeout: 15_000 });

  await page
    .getByRole('button', { name: 'Saldar el ticket por completo' })
    .click();

  await expect(page.getByText('Pago completado').first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText('Saldado').first()).toBeVisible();
};

const downloadInvoicePdf = async (page: Page, ticketId: string) => {
  const downloadButton = page
    .getByRole('button', { name: /Descargar \/ imprimir|Generar factura/ })
    .first();
  await expect(downloadButton).toBeVisible({ timeout: 15_000 });

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes(`/api/tickets/${ticketId}/invoice`) &&
        res.request().method() === 'GET',
      { timeout: 60_000 },
    ),
    downloadButton.click(),
  ]);

  expect(response.status()).toBe(200);
  expect((response.headers()['content-type'] ?? '').toLowerCase()).toMatch(
    /pdf/,
  );

  const body = await response.body();
  expect(body.byteLength).toBeGreaterThan(500);
  expect(Buffer.from(body.subarray(0, 4)).toString('utf8')).toBe('%PDF');

  await expect(page.getByText('PDF descargado correctamente')).toBeVisible({
    timeout: 15_000,
  });
};

test.describe('Mobile core business flows (Pixel 5)', () => {
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('creates ticket, updates service total, collects payment, downloads PDF', async ({
    page,
  }) => {
    const { ticketId } = await createClientAndTicket(page);

    await addServiceWithPrice(page, {
      quantity: INITIAL_QUANTITY,
      price: UNIT_PRICE,
    });
    await expectServicesTotal(page, UNIT_PRICE * INITIAL_QUANTITY);

    await page.getByRole('button', { name: 'Aumentar cantidad del servicio' }).click();
    await expect
      .poll(async () => {
        const quantityInput = page.getByLabel('Cantidad del servicio');
        return quantityInput.inputValue();
      })
      .toBe(String(UPDATED_QUANTITY));
    await expectServicesTotal(page, UNIT_PRICE * UPDATED_QUANTITY);

    const finalTotal = UNIT_PRICE * UPDATED_QUANTITY;
    await finishWithPartialPayment(page, ticketId, PARTIAL_PAYMENT);
    expect(PARTIAL_PAYMENT).toBeLessThan(finalTotal);

    await settleRemainingBalance(page);
    await downloadInvoicePdf(page, ticketId);
  });
});
