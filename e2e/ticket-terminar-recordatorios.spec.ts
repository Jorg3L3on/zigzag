import { test, expect } from '@playwright/test';
import { e2eCredentialsSkipReason, ensureTenantCompany, hasE2eCredentials, login } from './helpers/auth';
import {
  addComposerLine,
  createClientInComposer,
  openComposer,
  saveComposer,
} from './helpers/ticket-composer';

/**
 * ZIG-I36-26 (M-09): Terminar y generar recibo saves the terminate and the payment
 * first; the Recordatorios dialog only asks about reminders, so closing it with
 * X keeps both. Saves data: scratch DB or CI.
 */
test.describe('Terminar › Recordatorios @1280px', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('X on Recordatorios keeps the ticket finished and the payment', async ({ page }) => {
    const suffix = `${Date.now()}`.slice(-8);
    await openComposer(page);
    await createClientInComposer(page, { name: `Cliente terminar ${suffix}`, phone: `995${suffix.slice(-7)}` });
    await addComposerLine(page, { quantity: 1, price: 1000 });
    const ticketId = await saveComposer(page);

    const panel = page.locator('#finalizar').filter({ visible: true }).first();
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await panel.getByRole('radio', { name: /^(Una parte|Pagó una parte)$/ }).click();
    await panel.getByLabel('Cuánto pagó').fill('400');
    await panel.getByRole('button', { name: 'Terminar y generar recibo' }).click();

    // Saved first: the dialog is only the question about reminders.
    const dialog = page.getByRole('dialog', { name: 'Recordatorios de servicio' });
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    await dialog.getByRole('button', { name: /^Cerrar/ }).click();
    await expect(dialog).toBeHidden();

    // The ticket is finished with the payment, whichever way the dialog was closed.
    await expect(page.locator('#finalizar').filter({ visible: true })).toHaveCount(0, { timeout: 60_000 });
    await page.goto(`/tickets/${ticketId}`);
    await expect(page.getByTestId('ticket-status-pill').filter({ visible: true }).first()).toHaveText(
      'Pago parcial',
    );
    await expect(page.getByText('$400.00').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText('$600.00').filter({ visible: true }).first()).toBeVisible();
  });
});
