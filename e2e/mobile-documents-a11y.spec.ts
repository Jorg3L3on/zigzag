import { test, expect, type Page } from '@playwright/test';
import { e2eCredentialsSkipReason, ensureTenantCompany, hasE2eCredentials, login } from './helpers/auth';
import { expectNoSeriousViolations } from './helpers/a11y';
import { expectLayoutIntact, MOBILE_WIDTHS } from './helpers/layout';
import {
  addCustomComposerLine,
  createClientInComposer,
  finishOnReview,
  openComposer,
  saveComposer,
} from './helpers/ticket-composer';

/**
 * ZIG-I13-8: axe (WCAG A/AA, serious and critical) and the layout checks on every
 * redesigned document screen, sheets included, at phone widths. Saves data: run it
 * in CI or against a scratch database.
 */

for (const width of MOBILE_WIDTHS) {
  test.describe(`Documents a11y @${width}px`, () => {
    test.use({ viewport: { width, height: 812 } });
    test.setTimeout(420_000);

    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
      await ensureTenantCompany(page);
    });

    // The list card is role=button around a ⋮ menu button (nested-interactive), as on main and on
    // the other list cards: out of this redesign's scope, so that rule stays off for that screen.
    const axe = async (page: Page, label: string) => {
      await page.waitForTimeout(400);
      await expectNoSeriousViolations(page, label, {
        disable: label === 'tickets-list' ? ['nested-interactive'] : [],
      });
      await expectLayoutIntact(page, label);
    };

    test('composer, sheets, listo, details, editor and list have no serious violations', async ({ page }) => {
      const suffix = `${Date.now()}`.slice(-8);
      const clientName = `Visual documentos ${suffix}`;

      // Composer with the line sheet open on a catalog-less line.
      await openComposer(page);
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      await createClientInComposer(page, {
        name: clientName,
        phone: `988${suffix.slice(-7)}`,
      });
      await addCustomComposerLine(page, {
        name: 'Mantenimiento correctivo de unidad manejadora',
        quantity: '2',
        price: '4200',
        materials: 2,
      });
      await addCustomComposerLine(page, {
        name: 'Recarga de gas refrigerante',
        quantity: '3',
        price: '980',
      });
      await axe(page, 'composer');
      await page.getByTestId('composer-line-row').first().click();
      await expect(page.getByRole('dialog', { name: 'Editar servicio' })).toBeVisible();
      await axe(page, 'line-sheet');
      await page
        .getByRole('dialog', { name: 'Editar servicio' })
        .getByRole('button', { name: 'Cancelar' })
        .click();
      await expect(page.getByRole('dialog', { name: 'Editar servicio' })).toBeHidden();

      // Listo, then finalize half paid with the recibo shared.
      const ticketId = await saveComposer(page);
      await expect(page.getByRole('heading', { name: '¿Cómo pagó el cliente?' })).toBeVisible({
        timeout: 15_000,
      });
      await page.getByRole('radio', { name: 'Una parte' }).click();
      await page.getByLabel('Cuánto pagó').fill('3000');
      await axe(page, 'listo');
      await finishOnReview(page, ticketId, { mode: 'partial', amount: 3000 });

      // Ticket detail.
      await page.goto(`/tickets/${ticketId}`);
      await expect(page.getByTestId('ticket-hero').filter({ visible: true }).first()).toContainText(
        'Saldo por cobrar',
        {
          timeout: 15_000,
        },
      );
      await axe(page, 'ticket-detail');

      // Editor of a finalized ticket: banner and Antes in the sticky bar.
      await page.goto(`/tickets/${ticketId}/edit`);
      await expect(
        page.getByTestId('composer-finalized-banner').filter({ visible: true }).first(),
      ).toBeVisible({ timeout: 15_000 });
      await axe(page, 'editor-banner');

      // Delete sheet from the detail menu.
      await page.goto(`/tickets/${ticketId}`);
      await page
        .getByRole('button', { name: 'Más acciones del ticket' })
        .filter({ visible: true })
        .first()
        .click();
      await page.getByRole('menuitem', { name: 'Eliminar ticket' }).click();
      await expect(page.getByRole('dialog', { name: `¿Eliminar el ticket #${ticketId}?` })).toBeVisible();
      await axe(page, 'delete-sheet');
      await page.getByRole('button', { name: 'Conservar' }).click();

      // The list, filtered to the fixture.
      await page.goto('/tickets');
      await page.getByPlaceholder('Cliente, folio o teléfono').fill(suffix);
      await expect(page.getByText('1 de 1 tickets')).toBeVisible({
        timeout: 20_000,
      });
      await axe(page, 'tickets-list');

      // Presupuesto detail.
      await page.goto('/presupuestos/create');
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Cliente', exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await createClientInComposer(page, {
        name: clientName,
        phone: `987${suffix.slice(-7)}`,
      });
      await addCustomComposerLine(page, {
        name: 'Sustitución de sistema de aire acondicionado central',
        quantity: '1',
        price: '2855130',
        materials: 2,
      });
      await addCustomComposerLine(page, {
        name: 'Póliza de mantenimiento preventivo trimestral',
        quantity: '4',
        price: '14500',
      });
      await page.getByRole('button', { name: '15 días' }).click();
      await page
        .getByRole('textbox', { name: /Notas/ })
        .fill(
          '• 60% de anticipo, 40% contra entrega.\n• Entrega de 6 a 8 semanas después del anticipo.\n• Precios en MXN más IVA.',
        );
      await page
        .getByRole('button', { name: /^Guardar( presupuesto)?$/ })
        .filter({ visible: true })
        .first()
        .click();
      await page.waitForURL(/\/presupuestos\/\d+\/listo$/, { timeout: 60_000 });
      const presupuestoId = page.url().match(/\/presupuestos\/(\d+)/)?.[1] as string;
      await page.goto(`/presupuestos/${presupuestoId}`);
      await expect(page.getByTestId('presupuesto-accept').filter({ visible: true }).first()).toBeVisible({
        timeout: 15_000,
      });
      await axe(page, 'presupuesto-detail');
    });
  });
}
