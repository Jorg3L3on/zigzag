import { test, expect } from '@playwright/test';
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

    await openComposer(page);
    await createClientInComposer(page, { name: clientName, phone: clientPhone });
    await addComposerLine(page, { quantity: 1, price: 150 });
    const ticketId = await saveComposer(page);
    await page.waitForURL(new RegExp(`/tickets/${ticketId}$`), {
      timeout: 30_000,
    });

    await expect(
      page.getByRole('button', { name: 'Finalizar y generar recibo' }),
    ).toBeVisible();

    const finishButton = page.getByRole('button', {
      name: 'Finalizar y generar recibo',
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
    // Status chip is always visible; mobile app bar subtitle is md:hidden on desktop.
    await expect(page.getByText(/Finalizado ·/)).toBeVisible();

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
