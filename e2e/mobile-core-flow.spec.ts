import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import {
  addComposerLine,
  createClientInComposer,
  openComposer,
  saveComposer,
} from './helpers/ticket-composer';
import { formatServiceCurrency } from '../src/components/tickets/ticket-services-utils';

const uniqueSuffix = () => Date.now().toString().slice(-8);

const UNIT_PRICE = 100;
const INITIAL_QUANTITY = 2;
const UPDATED_QUANTITY = 3;
const PARTIAL_PAYMENT = 50;

const composeTicket = async (page: Page) => {
  const clientName = `Mobile E2E Client ${uniqueSuffix()}`;
  const clientPhone = `961${uniqueSuffix().slice(-7)}`;

  await openComposer(page);
  await createClientInComposer(page, { name: clientName, phone: clientPhone });
  const serviceName = await addComposerLine(page, {
    quantity: INITIAL_QUANTITY,
    price: UNIT_PRICE,
  });
  return { clientName, serviceName };
};

const expectServicesTotal = async (page: Page, amount: number) => {
  const formatted = formatServiceCurrency(amount);
  await expect(page.getByText(formatted, { exact: true }).first()).toBeVisible();
};

const finishWithPartialPayment = async (
  page: Page,
  ticketId: string,
  partialAmount: number,
) => {
  await page.waitForURL(new RegExp(`/tickets/${ticketId}$`), {
    timeout: 30_000,
  });

  await page.getByRole('button', { name: 'Pago parcial' }).click();
  await page.locator('#detail-paid-amount').fill(String(partialAmount));

  await page.getByRole('button', { name: 'Finalizar y generar recibo' }).click();

  const schedulesDialog = page.getByRole('dialog', {
    name: 'Recordatorios de servicio',
  });
  await expect(schedulesDialog).toBeVisible({ timeout: 15_000 });
  await schedulesDialog.getByRole('button', { name: 'Omitir' }).click();

  await page.waitForURL(new RegExp(`/tickets/${ticketId}$`), {
    timeout: 60_000,
  });
  // Status chip is always visible; avoid matching the mobile app bar subtitle alone.
  await expect(page.getByText(/Finalizado ·/)).toBeVisible();
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
    .getByRole('button', { name: /Descargar \/ imprimir|Generar recibo/ })
    .first();
  await expect(downloadButton).toBeVisible({ timeout: 15_000 });

  await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes(`/api/tickets/${ticketId}/invoice`) &&
        res.request().method() === 'GET' &&
        res.status() === 200,
      { timeout: 60_000 },
    ),
    downloadButton.click(),
  ]);

  await expect(page.getByText('PDF descargado correctamente')).toBeVisible({
    timeout: 15_000,
  });

  // Re-fetch for byte-level assertions (Playwright may not retain response bodies
  // after the page consumes the download stream).
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
    const { serviceName } = await composeTicket(page);
    await expectServicesTotal(page, UNIT_PRICE * INITIAL_QUANTITY);

    // Editar the draft line in its sheet before saving.
    await page.getByRole('button', { name: `Opciones de ${serviceName}` }).click();
    await page.getByRole('menuitem', { name: /Editar/ }).click();
    const editSheet = page.getByRole('dialog', { name: 'Editar servicio' });
    await editSheet
      .getByRole('button', { name: 'Aumentar cantidad del servicio' })
      .click();
    await expect(
      editSheet.getByRole('spinbutton', { name: 'Cantidad del servicio' }),
    ).toHaveValue(String(UPDATED_QUANTITY));
    await editSheet.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(editSheet).toBeHidden();
    await expectServicesTotal(page, UNIT_PRICE * UPDATED_QUANTITY);

    const ticketId = await saveComposer(page);

    const finalTotal = UNIT_PRICE * UPDATED_QUANTITY;
    await finishWithPartialPayment(page, ticketId, PARTIAL_PAYMENT);
    expect(PARTIAL_PAYMENT).toBeLessThan(finalTotal);

    await settleRemainingBalance(page);
    await downloadInvoicePdf(page, ticketId);
  });
});
