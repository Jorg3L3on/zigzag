import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import {
  addHeavyLines,
  createClientInComposer,
  expectInsideViewport,
  expectNoPageOverflow,
} from './helpers/ticket-composer';

/**
 * ZIG-I13-4: the ticket detail as drawn in the canvas (TicketDetail), with the
 * heavy fixture (8 lines, 21 materials, $1.2M line) that came from a presupuesto:
 * converts a presupuesto, finalizes the resulting ticket with a partial payment
 * and walks the detail. Saves data: run it in CI or against a scratch database.
 */

/** The page height of this ticket before the redesign (2026-10-10 QA run). */
const BASELINE_PAGE_HEIGHT = 3911;

for (const width of [375, 333]) {
  test.describe(`Ticket detail redesign @${width}px`, () => {
    test.use({ viewport: { width, height: 812 } });
    test.setTimeout(360_000);

    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
      await ensureTenantCompany(page);
    });

    test('balance hero, quick actions, summary, origin link, menu and payment sheet', async ({ page }) => {
      const suffix = `${Date.now()}`.slice(-8);
      const clientName = `Cliente detalle ${suffix}`;

      // A heavy presupuesto, converted to a ticket.
      await page.goto('/presupuestos/create');
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Cliente', exact: true })).toBeVisible({ timeout: 15_000 });
      await createClientInComposer(page, { name: clientName, phone: `995${suffix.slice(-7)}` });
      await addHeavyLines(page, { catalog: false });
      await page.getByRole('button', { name: /^Guardar( presupuesto)?$/ }).first().click();
      await page.waitForURL(/\/presupuestos\/\d+\/listo$/, { timeout: 60_000 });
      const presupuestoId = page.url().match(/\/presupuestos\/(\d+)/)?.[1] as string;

      await page.goto(`/presupuestos/${presupuestoId}`);
      await page.getByRole('button', { name: 'Convertir a ticket' }).first().click();
      await page.getByRole('alertdialog').getByRole('button', { name: /Convertir/ }).click();
      await page.waitForURL(/\/tickets\/\d+$/, { timeout: 60_000 });
      const ticketId = page.url().match(/\/tickets\/(\d+)/)?.[1] as string;

      // Converted, not finalized: origin link and the same payment choice as the listo.
      await expect(page.getByTestId('ticket-from-presupuesto').filter({ visible: true }).first()).toHaveAttribute(
        'href',
        `/presupuestos/${presupuestoId}`,
        { timeout: 15_000 },
      );
      await expect(page.getByTestId('ticket-status-pill').filter({ visible: true }).first()).toHaveText('En proceso');
      await expect(page.getByRole('heading', { name: '¿Cómo pagó el cliente?' })).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Una parte' })).toBeVisible();
      await expect(page.getByRole('radio', { name: 'Nada aún' })).toBeVisible();
      for (const radio of await page.getByRole('radio').all()) {
        await expect(radio).toHaveAttribute('aria-checked', 'false');
      }
      await expect(page.getByRole('button', { name: /Finalizar y generar recibo/ })).toBeDisabled();
      await expectNoPageOverflow(page, 'detail unfinalized');

      // Finalize with a partial payment (no catalog lines: no reminders dialog).
      await page.getByRole('radio', { name: 'Una parte' }).click();
      await page.getByLabel('Cuánto pagó').fill('500000');
      await page.getByRole('button', { name: /Finalizar y generar recibo/ }).click();
      await expect(page.getByTestId('ticket-status-pill').filter({ visible: true }).first()).toHaveText(
        'Pago parcial',
        { timeout: 60_000 },
      );

      // Balance first: hero, progress and Pagado X de Y.
      const hero = page.getByTestId('ticket-hero').filter({ visible: true }).first();
      await expect(hero).toContainText('Saldo por cobrar');
      await expect(hero.getByTestId('ticket-hero-paid')).toContainText('Pagado $500,000.00 de');
      await expect(hero.getByRole('progressbar')).toBeVisible();
      await expectInsideViewport(page, hero, 'hero');

      // Quick actions: Cobrar / Compartir recibo / Llamar, all on the first screen.
      const quick = page.getByTestId('ticket-quick-actions').filter({ visible: true }).first();
      await expect(quick.getByRole('button', { name: 'Cobrar' })).toBeVisible();
      await expect(quick.getByRole('button', { name: 'Compartir recibo' })).toBeVisible();
      await expect(quick.getByRole('link', { name: 'Llamar' })).toBeVisible();
      await expectInsideViewport(page, quick, 'quick actions');

      // Check 1: hero, quick actions and the services summary within 1.5 screens; page much shorter.
      const servicesHeading = page.getByRole('heading', { name: /^Servicios/ }).filter({ visible: true }).first();
      const summaryToggle = page.getByRole('button', { name: /^Ver detalle con \d+ materiales$/ });
      const toggleBox = await summaryToggle.boundingBox();
      const scrollTop = await page.evaluate(() => window.scrollY);
      expect(toggleBox!.y + scrollTop + toggleBox!.height, 'services summary within 1.5 screens').toBeLessThanOrEqual(
        812 * 1.5,
      );
      await expect(servicesHeading).toBeVisible();
      const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(pageHeight, `page height ${pageHeight}px vs ${BASELINE_PAGE_HEIGHT}px before`).toBeLessThanOrEqual(
        BASELINE_PAGE_HEIGHT * 0.6,
      );

      // Servicios: three rows, Editar, and the fold with the 21 materials.
      await expect(page.getByRole('link', { name: 'Editar servicios' }).first()).toHaveAttribute(
        'href',
        `/tickets/${ticketId}/services`,
      );
      await expect(page.getByRole('button', { name: 'Ver detalle con 21 materiales' })).toBeVisible();

      // Pagos · 1, Actividad folded with Creado/Actualizado inside, no Contacto card.
      await expect(page.getByRole('heading', { name: /^Pagos/ }).filter({ visible: true }).first()).toContainText('1');
      await expect(page.getByTestId('ticket-payment-row')).toHaveCount(1);
      const activity = page.getByRole('button', { name: /^Actividad/ }).filter({ visible: true }).first();
      await expect(activity).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByText('Creado', { exact: true }).filter({ visible: true })).toHaveCount(0);
      await activity.click();
      await expect(page.getByText('Creado', { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Contacto' })).toHaveCount(0);
      await expectNoPageOverflow(page, 'detail finalized');

      // Sticky Registrar pago opens the same sheet as Cobrar.
      const sticky = page.getByRole('button', { name: 'Registrar pago' }).filter({ visible: true }).first();
      await expectInsideViewport(page, sticky, 'Registrar pago');
      await sticky.click();
      const sheet = page.getByRole('dialog', { name: 'Registrar pago' });
      await expect(sheet).toBeVisible();
      await sheet.getByRole('button', { name: 'Cerrar diálogo' }).click();
      await expect(sheet).toBeHidden();

      // ⋯ menu: the four actions.
      await page.getByRole('button', { name: 'Más acciones del ticket' }).filter({ visible: true }).first().click();
      await expect(page.getByRole('menuitem', { name: 'Editar servicios' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Descargar PDF' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Duplicar ticket' })).toBeVisible();
      await page.getByRole('menuitem', { name: 'Eliminar ticket' }).click();

      // Delete sheet: names what is lost; Conservar keeps the ticket.
      const deleteSheet = page.getByRole('dialog', { name: `¿Eliminar el ticket #${ticketId}?` });
      await expect(deleteSheet).toBeVisible();
      await expect(deleteSheet).toContainText(clientName);
      await expect(deleteSheet).toContainText('Tiene 1 pago registrado por $500,000.00');
      await expect(deleteSheet).not.toContainText(/papelera/i);
      await deleteSheet.getByRole('button', { name: 'Conservar' }).click();
      await expect(deleteSheet).toBeHidden();
      await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}$`));
    });
  });
}
