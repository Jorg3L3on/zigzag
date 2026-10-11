import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import {
  addCustomComposerLine,
  createClientInComposer,
  finishOnReview,
  openComposer,
  saveComposer,
} from './helpers/ticket-composer';

/**
 * ZIG-I13-8 visual baselines of the redesigned document screens at 390px (the
 * canvas size), light and dark: composer, line sheet, listo, ticket detail,
 * presupuesto detail, the finalized-ticket editor with its banner, the delete
 * sheet and the tickets list. A fixture ticket (finalized, half paid, recibo
 * shared) and presupuesto are created through the UI on every run; names,
 * amounts, folios and dates are masked, so the baselines hold layout, hierarchy
 * and chrome.
 *
 * Saves data: run it against a scratch database. Update snapshots:
 *   npm run test:e2e:visual:update -- e2e/documents-redesign-visual.spec.ts
 */

/** Everything that changes from one run to the next. */
const dynamicRegions = (page: Page) => [
  page.locator('[data-money-size]'),
  page.getByTestId('ticket-card-name'),
  page.getByTestId('ticket-payment-summary'),
  page.getByTestId('ticket-card-meta'),
  page.getByTestId('composer-party-name'),
  page.getByTestId('composer-line-meta'),
  page.getByTestId('document-line-meta'),
  page.getByTestId('document-line-amount'),
  page.getByTestId('composer-line-headline'),
  page.getByTestId('ticket-detail-title'),
  page.getByTestId('review-summary'),
  page.getByTestId('presupuesto-counts'),
  page.getByTestId('presupuesto-expires'),
  page.getByTestId('tickets-balance-due'),
  page.getByTestId('delete-ticket-summary'),
  page.locator('h1'),
  page.locator('time'),
  page.getByText(/^#\d+$/),
  page.getByText(/Ticket (?:#\d+|[A-Z0-9]+-\d+)/),
  page.getByText(/Presupuesto (?:#\d+|[A-Z0-9]+-\d+)/),
  page.getByText(/\d+ de \d+ tickets/),
  page.getByText(/Búsqueda:/),
  page.getByText(/Hoy[,·]/),
  page.getByText(/Emitido el/),
  page.getByText(/el recibo se compartió el \d+ de \w+/),
];

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`Documents redesign visual (${colorScheme})`, () => {
    test.use({
      viewport: { width: 390, height: 844 },
      colorScheme,
      contextOptions: { reducedMotion: 'reduce' },
    });
    test.setTimeout(600_000);

    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
      await ensureTenantCompany(page);
    });

    const shot = async (page: Page, name: string) => {
      await page.mouse.move(0, 0);
      // Toasts (client created, saved) come and go on their own clock: keep them out of the baselines.
      await page.addStyleTag({ content: '[data-sonner-toaster]{visibility:hidden !important}' });
      await page.waitForTimeout(700);
      await expect(page).toHaveScreenshot(`documents-${name}-${colorScheme}.png`, {
        fullPage: false,
        mask: dynamicRegions(page),
      });
    };

    test('every redesigned screen matches its baseline', async ({ page }) => {
      const suffix = `${Date.now()}`.slice(-8);
      const clientName = `Visual documentos ${suffix}`;

      // Composer with the line sheet open on a catalog-less line.
      await openComposer(page);
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      await createClientInComposer(page, { name: clientName, phone: `988${suffix.slice(-7)}` });
      await addCustomComposerLine(page, { name: 'Mantenimiento correctivo de unidad manejadora', quantity: '2', price: '4200', materials: 2 });
      await addCustomComposerLine(page, { name: 'Recarga de gas refrigerante', quantity: '3', price: '980' });
      await shot(page, 'composer');
      await page.getByTestId('composer-line-row').first().click();
      await expect(page.getByRole('dialog', { name: 'Editar servicio' })).toBeVisible();
      await shot(page, 'line-sheet');
      await page.getByRole('dialog', { name: 'Editar servicio' }).getByRole('button', { name: 'Cancelar' }).click();
      await expect(page.getByRole('dialog', { name: 'Editar servicio' })).toBeHidden();

      // Listo, then finalize half paid with the recibo shared.
      const ticketId = await saveComposer(page);
      await expect(page.getByRole('heading', { name: '¿Cómo pagó el cliente?' })).toBeVisible({ timeout: 15_000 });
      await page.getByRole('radio', { name: 'Una parte' }).click();
      await page.getByLabel('Cuánto pagó').fill('3000');
      await shot(page, 'listo');
      await finishOnReview(page, ticketId, { mode: 'partial', amount: 3000 });

      // Ticket detail.
      await page.goto(`/tickets/${ticketId}`);
      await expect(page.getByTestId('ticket-hero').filter({ visible: true }).first()).toContainText('Saldo por cobrar', {
        timeout: 15_000,
      });
      await shot(page, 'ticket-detail');

      // Editor of a finalized ticket: banner and Antes in the sticky bar.
      await page.goto(`/tickets/${ticketId}/edit`);
      await expect(page.getByTestId('composer-finalized-banner').filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
      await shot(page, 'editor-banner');

      // Delete sheet from the detail menu.
      await page.goto(`/tickets/${ticketId}`);
      await page.getByRole('button', { name: 'Más acciones del ticket' }).filter({ visible: true }).first().click();
      await page.getByRole('menuitem', { name: 'Eliminar ticket' }).click();
      await expect(page.getByRole('dialog', { name: `¿Eliminar el ticket #${ticketId}?` })).toBeVisible();
      await shot(page, 'delete-sheet');
      await page.getByRole('button', { name: 'Conservar' }).click();

      // The list, filtered to the fixture.
      await page.goto('/tickets');
      await page.getByPlaceholder('Cliente, folio o teléfono').fill(suffix);
      await expect(page.getByText('1 de 1 tickets')).toBeVisible({ timeout: 20_000 });
      await shot(page, 'tickets-list');

      // Presupuesto detail.
      await page.goto('/presupuestos/create');
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Cliente', exact: true })).toBeVisible({ timeout: 15_000 });
      await createClientInComposer(page, { name: clientName, phone: `987${suffix.slice(-7)}` });
      await addCustomComposerLine(page, { name: 'Sustitución de sistema de aire acondicionado central', quantity: '1', price: '2855130', materials: 2 });
      await addCustomComposerLine(page, { name: 'Póliza de mantenimiento preventivo trimestral', quantity: '4', price: '14500' });
      await page.getByRole('button', { name: '15 días' }).click();
      await page
        .getByRole('textbox', { name: /Notas/ })
        .fill('• 60% de anticipo, 40% contra entrega.\n• Entrega de 6 a 8 semanas después del anticipo.\n• Precios en MXN más IVA.');
      await page.getByRole('button', { name: /^Guardar( presupuesto)?$/ }).filter({ visible: true }).first().click();
      await page.waitForURL(/\/presupuestos\/\d+\/listo$/, { timeout: 60_000 });
      const presupuestoId = page.url().match(/\/presupuestos\/(\d+)/)?.[1] as string;
      await page.goto(`/presupuestos/${presupuestoId}`);
      await expect(page.getByTestId('presupuesto-accept').filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
      await shot(page, 'presupuesto-detail');
    });
  });
}
