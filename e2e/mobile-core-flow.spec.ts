import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import {
  addComposerLine,
  createClientInComposer,
  finishOnReview,
  openComposer,
  saveComposer,
} from './helpers/ticket-composer';
import { formatServiceCurrency } from '../src/components/tickets/ticket-services-utils';

const uniqueSuffix = () => Date.now().toString().slice(-8);

/**
 * After a hard navigation Next may still hold streamed sections in hidden
 * placeholders (duplicate ids/text for a moment); act on the visible copy.
 */
const visible = (locator: Locator) => locator.filter({ visible: true }).first();

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
  await finishOnReview(page, ticketId, { mode: 'partial', amount: partialAmount });

  await page.goto(`/tickets/${ticketId}`);
  // Status chip is always visible; avoid matching the mobile app bar subtitle alone.
  // After a hard navigation Next may still hold streamed chunks in hidden
  // placeholders, so match the visible chip (strict mode would fail at once).
  // Balance first (ZIG-I13-4): the pill says Pago parcial and the hero the saldo.
  await expect(visible(page.getByTestId('ticket-status-pill'))).toHaveText('Pago parcial', {
    timeout: 15_000,
  });
  await expect(visible(page.getByTestId('ticket-hero'))).toContainText('Saldo por cobrar');
};

const settleRemainingBalance = async (page: Page) => {
  // Cobrar (quick action) opens the Registrar pago sheet.
  const cobrar = visible(page.getByRole('button', { name: 'Cobrar', exact: true }));
  await expect(cobrar).toBeVisible({ timeout: 15_000 });
  await cobrar.click();
  const sheet = page.getByRole('dialog', { name: 'Registrar pago' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Saldar el ticket por completo' }).click();

  await expect(visible(page.getByTestId('ticket-hero-paid'))).toHaveText('Saldado', {
    timeout: 30_000,
  });
  await expect(visible(page.getByTestId('ticket-status-pill'))).toHaveText('Pagado');
};

const downloadInvoicePdf = async (page: Page, ticketId: string) => {
  // Descargar PDF lives in the ⋯ menu of the app bar (ZIG-I13-4).
  const menu = visible(page.getByRole('button', { name: 'Más acciones del ticket' }));
  await expect(menu).toBeVisible({ timeout: 15_000 });
  await menu.click();
  const downloadButton = page.getByRole('menuitem', { name: 'Descargar PDF' });
  await expect(downloadButton).toBeVisible();

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

  await expect(page.getByText('PDF descargado').first()).toBeVisible({
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
    await page
      .getByRole('list', { name: 'Servicios del ticket' })
      .getByRole('button', { name: new RegExp(serviceName) })
      .click();
    const editSheet = page.getByRole('dialog', { name: 'Editar servicio' });
    await editSheet
      .getByRole('button', { name: 'Aumentar cantidad del servicio' })
      .click();
    await expect(
      editSheet.getByRole('spinbutton', { name: 'Cantidad del servicio' }),
    ).toHaveValue(String(UPDATED_QUANTITY));
    await editSheet.getByRole('button', { name: 'Guardar línea' }).click();
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
