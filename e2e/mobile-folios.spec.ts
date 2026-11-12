import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

/** ZIG-I17-4..6: documents carry the company folio (R-0001 / P-0001) instead of the row id. */

test.describe('Company folios', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('the ticket list and detail show the R folio', async ({ page }) => {
    await page.goto('/tickets');
    const folio = page.getByText(/^R-\d{4,}$/).filter({ visible: true }).first();
    await expect(folio).toBeVisible({ timeout: 30_000 });
    const label = (await folio.textContent())?.trim() as string;

    // The folio is searchable.
    await page.getByRole('textbox', { name: /Buscar tickets/ }).fill(label);
    await expect(page.getByText(label).filter({ visible: true }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('the presupuestos list shows the P folio', async ({ page }) => {
    await page.goto('/presupuestos');
    await expect(page.getByText(/^P-\d{4,}$/).filter({ visible: true }).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  // ZIG-I26-2: a converted ticket shows its own R folio and links back to the presupuesto.
  test('a ticket converted from a presupuesto shows its own R folio', async ({ page }) => {
    await page.goto('/presupuestos');
    const chip = page.getByRole('button', { name: /^Aceptados/ });
    await expect(chip).toBeVisible({ timeout: 30_000 });
    if ((await chip.getAttribute('aria-pressed')) !== 'true') await chip.click();

    const row = page.getByRole('link', { name: /^Presupuesto P-\d{4,} · .+ · Aceptado$/ }).first();
    test.skip((await row.count()) === 0, 'No accepted presupuesto in this tenant');
    const quoteFolio = /P-\d{4,}/.exec((await row.getAttribute('aria-label')) ?? '')![0];
    await row.click();

    // The presupuesto keeps its P folio and points at the ticket.
    await expect(
      page.getByText(`Presupuesto ${quoteFolio}`, { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Aceptado · convertido en ticket')).toBeVisible();
    await page.getByRole('link', { name: 'Ver ticket' }).click();

    const fromLink = page.getByTestId('ticket-from-presupuesto').filter({ visible: true }).first();
    await expect(fromLink).toHaveText(`Desde presupuesto ${quoteFolio}`, { timeout: 30_000 });
    const title = page.getByText(/^Ticket R-\d{4,}$/).filter({ visible: true }).first();
    await expect(title).toBeVisible();
    await expect(page.getByText(`Ticket ${quoteFolio}`)).toHaveCount(0);

    // The list shows the same folio as the detail.
    const ticketFolio = ((await title.textContent()) ?? '').trim().replace(/^Ticket /, '');
    await page.goto('/tickets');
    await page.getByRole('textbox', { name: /Buscar tickets/ }).fill(ticketFolio);
    await expect(page.getByText(ticketFolio, { exact: true }).filter({ visible: true }).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
