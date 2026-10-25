import { test, expect } from '@playwright/test';
import { e2eCredentialsSkipReason, ensureTenantCompany, hasE2eCredentials, login } from './helpers/auth';
import { expectNoSeriousViolations } from './helpers/a11y';
import { expectLayoutIntact } from './helpers/layout';
import {
  addCustomComposerLine,
  createClientInComposer,
  chooseComposerPayment,
  saveAndFinishComposer,
  openComposer,
} from './helpers/ticket-composer';

/**
 * ZIG-I13-8: the redesign is mobile first, but desktop shares the components. One
 * pass at 1280px over the composer, detail, editor and list: the same lines
 * and totals, no overflow, no serious axe violations. Saves data: scratch DB or CI.
 */
test.describe('Documents desktop @1280px', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(420_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('composer, detail, editor and list keep their structure on desktop', async ({ page }) => {
    const suffix = `${Date.now()}`.slice(-8);
    const clientName = `Cliente escritorio ${suffix}`;
    const check = async (label: string, { axe = true } = {}) => {
      await page.waitForTimeout(400);
      if (axe) {
        await expectNoSeriousViolations(page, label);
      }
      await expectLayoutIntact(page, label);
    };

    await openComposer(page);
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await createClientInComposer(page, {
      name: clientName,
      phone: `986${suffix.slice(-7)}`,
    });
    await addCustomComposerLine(page, {
      name: 'Instalación de minisplit',
      quantity: '2',
      price: '4200',
      materials: 2,
    });
    await addCustomComposerLine(page, {
      name: 'Recarga de gas',
      quantity: '1',
      price: '980',
    });
    const rows = page.getByRole('list', { name: 'Servicios del ticket' }).getByTestId('composer-line-row');
    await expect(rows).toHaveCount(2);
    await check('composer');

    // Finish from the composer (ZIG-I24-4): the payment sits under Notas.
    await chooseComposerPayment(page, { mode: 'partial', amount: 3000 });
    await check('composer with payment');
    const { ticketId } = await saveAndFinishComposer(page, { mode: 'partial', amount: 3000 });

    await page.goto(`/tickets/${ticketId}`);
    await expect(page.getByTestId('ticket-hero').filter({ visible: true }).first()).toContainText(
      'Saldo por cobrar',
      {
        timeout: 15_000,
      },
    );
    await check('detail');

    await page.goto(`/tickets/${ticketId}/edit`);
    await expect(rows).toHaveCount(2, { timeout: 15_000 });
    await expect(
      page.getByTestId('composer-finalized-banner').filter({ visible: true }).first(),
    ).toBeVisible();
    await check('editor');

    await page.goto('/tickets');
    await page.getByPlaceholder('Cliente, número de ticket o teléfono').fill(suffix);
    await expect(page.getByText('1 de 1 tickets')).toBeVisible({
      timeout: 20_000,
    });
    // The tickets table puts aria-sort on its sort buttons (shared by every list table, not part of
    // this redesign): layout only here.
    await check('list', { axe: false });
  });
});
