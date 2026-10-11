import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import { expectLayoutIntact, MOBILE_WIDTHS } from './helpers/layout';
import {
  addCustomComposerLine,
  addHeavyLines,
  createClientInComposer,
  expectInsideViewport,
  finishOnReview,
  openComposer,
  saveComposer,
} from './helpers/ticket-composer';

/**
 * ZIG-I13-8: the whole mobile document lifecycle of the redesign, at 375 and
 * 333px, with the 2026-10-10 QA fixtures: a heavy ticket (8 lines, one of
 * $1,234,567.89, 21 materials) and a heavy presupuesto (4 conceptos with
 * materials and conditions). Every screen is checked for sideways scroll,
 * clipped content and truncated money, and the primary action of each screen
 * for being where the canvas puts it. Saves and deletes data: run it in CI or
 * against a scratch database, never against production.
 */

const PRESUPUESTO_LINES = 'Servicios del presupuesto';
const TICKET_LINES = 'Servicios del ticket';
const CONDITIONS =
  '• 60% de anticipo, 40% contra entrega.\n• Entrega de 6 a 8 semanas después del anticipo.\n• Precios en MXN más IVA.\n• Vigencia sujeta a existencias.';
const CONCEPTS = [
  { name: 'Sustitución de sistema de aire acondicionado central con unidades manejadoras de aire', quantity: '1', price: '2855130', materials: 3 },
  { name: 'Desmontaje y disposición final de equipos obsoletos en azotea', quantity: '4', price: '8375', materials: 2 },
  { name: 'Póliza de mantenimiento preventivo trimestral', quantity: '4', price: '14500', materials: 2 },
  { name: 'X'.repeat(100), quantity: '1', price: '1200', materials: 0 },
];

/** After a hard navigation Next may hold a hidden streamed copy of a block (CI): act on the visible one. */
const visible = (locator: Locator) => locator.filter({ visible: true }).first();

const saveButton = (page: Page) => visible(page.getByRole('button', { name: /^Guardar( ticket| presupuesto)?$/ }));

const stubShare = async (page: Page) => {
  await page.evaluate(() => {
    (window as unknown as { __openedUrls: string[] }).__openedUrls = [];
    window.open = ((url?: string | URL) => {
      (window as unknown as { __openedUrls: string[] }).__openedUrls.push(String(url));
      return null;
    }) as typeof window.open;
  });
};

for (const width of MOBILE_WIDTHS) {
  test.describe(`Documents lifecycle @${width}px`, () => {
    test.use({ viewport: { width, height: 812 } });
    test.setTimeout(900_000);

    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
      await ensureTenantCompany(page);
    });

    test('presupuesto: create, listo, detail, duplicate, convert, cancel', async ({ page }) => {
      const suffix = `${Date.now()}`.slice(-8);
      const clientName = `Cliente ciclo ${suffix}`;

      // Create the heavy presupuesto.
      await page.goto('/presupuestos/create');
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Cliente', exact: true })).toBeVisible({ timeout: 15_000 });
      await createClientInComposer(page, { name: clientName, phone: `990${suffix.slice(-7)}` });
      for (const concept of CONCEPTS) await addCustomComposerLine(page, concept);
      await page.getByRole('button', { name: '15 días' }).click();
      await page.getByRole('textbox', { name: /Notas/ }).fill(CONDITIONS);
      await expectLayoutIntact(page, 'presupuesto composer');
      await expectInsideViewport(page, saveButton(page), 'Guardar presupuesto');
      await saveButton(page).click();

      // Listo: Compartir presupuesto is the one primary action.
      await page.waitForURL(/\/presupuestos\/\d+\/listo$/, { timeout: 60_000 });
      const presupuestoId = page.url().match(/\/presupuestos\/(\d+)/)?.[1] as string;
      await expect(visible(page.getByTestId('review-total'))).toBeVisible({ timeout: 15_000 });
      await expectInsideViewport(page, visible(page.getByRole('button', { name: /Compartir/ })), 'Compartir presupuesto');
      await expectLayoutIntact(page, 'presupuesto listo');

      // Detail: Convertir a ticket is on the first screen.
      await page.goto(`/presupuestos/${presupuestoId}`);
      await expect(visible(page.getByTestId('presupuesto-status'))).toHaveText('Abierto', { timeout: 15_000 });
      await expectInsideViewport(
        page,
        visible(page.getByTestId('presupuesto-accept')).getByRole('button', { name: 'Convertir a ticket' }),
        'Convertir a ticket',
      );
      await expectInsideViewport(page, visible(page.getByTestId('presupuesto-actions')), 'Editar / Duplicar / Cancelar');
      await expectLayoutIntact(page, 'presupuesto detail');

      // Duplicar: the composer opens prefilled with every concept and material; Guardar makes a copy.
      await visible(page.getByTestId('presupuesto-actions')).getByRole('button', { name: 'Duplicar' }).click();
      await page.waitForURL(/\/presupuestos\/create$/, { timeout: 30_000 });
      await expect(
        page.getByRole('list', { name: PRESUPUESTO_LINES }).getByTestId('composer-line-row'),
      ).toHaveCount(CONCEPTS.length, { timeout: 15_000 });
      await expect(page.getByTestId('composer-sticky-hint')).toHaveText('4 servicios · 7 materiales');
      await expectLayoutIntact(page, 'duplicated presupuesto composer');
      await saveButton(page).click();
      await page.waitForURL(/\/presupuestos\/\d+\/listo$/, { timeout: 60_000 });
      const copyId = page.url().match(/\/presupuestos\/(\d+)/)?.[1] as string;
      expect(copyId).not.toBe(presupuestoId);

      // Cancelar the copy: a sheet names the action, the detail becomes read-only.
      await page.goto(`/presupuestos/${copyId}`);
      await visible(page.getByTestId('presupuesto-actions')).getByRole('button', { name: 'Cancelar presupuesto' }).click();
      const cancelSheet = page.getByRole('dialog', { name: /¿Cancelar el presupuesto (?:#\d+|[A-Z0-9]+-\d+)\?/ });
      await expect(cancelSheet).toBeVisible();
      await expectInsideViewport(page, cancelSheet.getByRole('button', { name: 'Cancelar presupuesto' }), 'cancel confirm');
      await cancelSheet.getByRole('button', { name: 'Cancelar presupuesto' }).click();
      await expect(visible(page.getByTestId('presupuesto-status'))).toHaveText('Cancelado', { timeout: 30_000 });
      await expectLayoutIntact(page, 'presupuesto cancelado');

      // Convertir the original: the ticket shows its origin and asks how the client paid.
      await page.goto(`/presupuestos/${presupuestoId}`);
      await visible(page.getByTestId('presupuesto-accept')).getByRole('button', { name: 'Convertir a ticket' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Convertir a ticket' }).click();
      await page.waitForURL(/\/tickets\/\d+$/, { timeout: 60_000 });
      const convertedId = page.url().match(/\/tickets\/(\d+)/)?.[1] as string;
      await expect(visible(page.getByTestId('ticket-from-presupuesto'))).toHaveAttribute(
        'href',
        `/presupuestos/${presupuestoId}`,
        { timeout: 15_000 },
      );
      await expect(page.getByRole('heading', { name: '¿Cómo pagó el cliente?' })).toBeVisible();
      await expectLayoutIntact(page, 'converted ticket');

      // Convertido: the presupuesto points at the ticket and still duplicates.
      await page.goto(`/presupuestos/${presupuestoId}`);
      await expect(visible(page.getByTestId('presupuesto-status'))).toHaveText('Convertido', { timeout: 15_000 });
      await expect(visible(page.getByText('Convertido en ticket'))).toBeVisible();
      await expectLayoutIntact(page, 'presupuesto convertido');
    });

    test('ticket: create, listo, finalize, detail, edit, resend, list, duplicate, delete', async ({ page }) => {
      const suffix = `${Date.now()}`.slice(-8);
      const clientName = `Cliente ciclo ticket ${suffix}`;

      // Create the heavy ticket: 8 lines (one $1,234,567.89) and 21 materials.
      await openComposer(page);
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      await createClientInComposer(page, { name: clientName, phone: `989${suffix.slice(-7)}` });
      await addHeavyLines(page);
      await expect(page.getByTestId('composer-sticky-hint')).toHaveText('8 servicios · 21 materiales');
      await expectLayoutIntact(page, 'ticket composer');
      await expectInsideViewport(page, saveButton(page), 'Guardar');
      const ticketId = await saveComposer(page);

      // Listo: the payment choice is on the first screen with the heavy ticket.
      await expect(page.getByText(/Ticket (?:#\d+|[A-Z0-9]+-\d+) guardado/).filter({ visible: true }).first()).toBeVisible({
        timeout: 15_000,
      });
      const payBox = await page.getByRole('heading', { name: '¿Cómo pagó el cliente?' }).boundingBox();
      expect(payBox!.y, 'payment choice on the first screen').toBeLessThan(812);
      await expectLayoutIntact(page, 'ticket listo');
      await page.getByRole('radio', { name: 'Una parte' }).click();
      await page.getByLabel('Cuánto pagó').fill('500000');
      await expect(page.getByTestId('review-sticky-amount')).toBeVisible();
      await expectInsideViewport(page, visible(page.getByRole('button', { name: 'Terminar y enviar' })), 'Terminar y enviar');
      await expectLayoutIntact(page, 'ticket listo with payment');
      await finishOnReview(page, ticketId, { mode: 'partial', amount: 500000 });

      // Detail: balance first, quick actions and the services summary on the first screens.
      await page.goto(`/tickets/${ticketId}`);
      const hero = visible(page.getByTestId('ticket-hero'));
      await expect(hero).toContainText('Saldo por cobrar', { timeout: 15_000 });
      await expectInsideViewport(page, hero, 'hero');
      await expectInsideViewport(page, visible(page.getByTestId('ticket-quick-actions')), 'quick actions');
      await expectInsideViewport(page, visible(page.getByRole('button', { name: 'Cobrar' })), 'Cobrar');
      await expectLayoutIntact(page, 'ticket detail');

      // Editar in the composer: change a quantity, remove a line, Deshacer brings it back.
      await visible(page.getByRole('link', { name: 'Editar servicios' })).click();
      await page.waitForURL(new RegExp(`/tickets/${ticketId}/edit$`), { timeout: 30_000 });
      const rows = page.getByRole('list', { name: TICKET_LINES }).getByTestId('composer-line-row');
      await expect(rows).toHaveCount(8, { timeout: 15_000 });
      await expect(visible(page.getByTestId('composer-finalized-banner'))).toContainText('Este ticket ya se finalizó');
      await expectLayoutIntact(page, 'ticket editor');
      await rows.nth(1).click();
      const sheet = page.getByRole('dialog', { name: 'Editar servicio' });
      await sheet.getByRole('spinbutton', { name: 'Cantidad del servicio' }).fill('2');
      await expectInsideViewport(page, sheet.getByRole('button', { name: 'Agregar al ticket' }), 'Agregar al ticket');
      await sheet.getByRole('button', { name: 'Agregar al ticket' }).click();
      await expect(sheet).toBeHidden({ timeout: 10_000 });
      await rows.nth(7).click();
      await page.getByRole('dialog', { name: 'Editar servicio' }).getByRole('button', { name: 'Quitar este servicio' }).click();
      await expect(rows).toHaveCount(7);
      await page.getByRole('button', { name: 'Deshacer' }).click();
      await expect(rows).toHaveCount(8);
      await expect(page.getByTestId('composer-sticky-hint')).toHaveText(/^Antes \$[\d,]+\.\d{2} · \+\$[\d,]+\.\d{2}$/);
      await expectInsideViewport(page, visible(page.getByRole('button', { name: /^Guardar cambios$/ })), 'Guardar cambios');
      await expectLayoutIntact(page, 'ticket editor changed');
      await visible(page.getByRole('button', { name: /^Guardar cambios$/ })).click();

      // The detail offers the new recibo.
      await page.waitForURL(new RegExp(`/tickets/${ticketId}\\?reenviar=1$`), { timeout: 60_000 });
      await stubShare(page);
      const resend = page.getByRole('dialog', { name: '¿Reenviar el recibo nuevo?' });
      await expect(resend).toBeVisible({ timeout: 15_000 });
      await expectInsideViewport(page, resend.getByRole('button', { name: 'Reenviar recibo' }), 'Reenviar recibo');
      await resend.getByRole('button', { name: 'Reenviar recibo' }).click();
      await expect(resend).toBeHidden({ timeout: 60_000 });
      await expectLayoutIntact(page, 'ticket detail after edit');

      // The list: compact cards, whole money, Por cobrar header.
      await page.goto('/tickets');
      const search = page.getByPlaceholder('Cliente, número de ticket o teléfono');
      await search.fill(suffix);
      await expect(page.getByText('1 de 1 tickets')).toBeVisible({ timeout: 20_000 });
      await expect(visible(page.getByTestId('tickets-balance-due'))).toBeVisible();
      await expectLayoutIntact(page, 'tickets list');

      // Duplicar ticket: the composer opens prefilled with every line and material.
      await page.goto(`/tickets/${ticketId}`);
      await visible(page.getByRole('button', { name: 'Más acciones del ticket' })).click();
      await page.getByRole('menuitem', { name: 'Duplicar ticket' }).click();
      await page.waitForURL(/\/tickets\/create$/, { timeout: 30_000 });
      await expect(page.getByRole('list', { name: TICKET_LINES }).getByTestId('composer-line-row')).toHaveCount(8, {
        timeout: 15_000,
      });
      await expect(page.getByTestId('composer-sticky-hint')).toHaveText('8 servicios · 21 materiales');
      await expectLayoutIntact(page, 'duplicated ticket composer');
      await page.evaluate(() => window.localStorage.clear());

      // Eliminar from the detail menu: the sheet names the client, the total and the payment.
      await page.goto(`/tickets/${ticketId}`);
      await visible(page.getByRole('button', { name: 'Más acciones del ticket' })).click();
      await page.getByRole('menuitem', { name: 'Eliminar ticket' }).click();
      const deleteSheet = page.getByRole('dialog', { name: /¿Eliminar el ticket (?:#\d+|[A-Z0-9]+-\d+)\?/ });
      await expect(deleteSheet).toBeVisible();
      await expect(deleteSheet).toContainText(clientName);
      await expect(deleteSheet).toContainText('Tiene 1 pago registrado por $500,000.00');
      await expect(deleteSheet).not.toContainText(/papelera/i);
      await expectInsideViewport(page, deleteSheet.getByRole('button', { name: 'Eliminar ticket' }), 'Eliminar ticket');
      await expectInsideViewport(page, deleteSheet.getByRole('button', { name: 'Conservar' }), 'Conservar');
      await deleteSheet.getByRole('button', { name: 'Eliminar ticket' }).click();
      await page.waitForURL(/\/tickets$/, { timeout: 60_000 });
    });
  });
}
