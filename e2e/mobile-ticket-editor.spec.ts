import { test, expect, type Locator } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import {
  addCustomComposerLine,
  createClientInComposer,
  expectInsideViewport,
  expectNoPageOverflow,
  saveAndFinishComposer,
  openComposer,
  saveComposer,
} from './helpers/ticket-composer';
import { MOBILE_WIDTHS } from './helpers/layout';

/**
 * ZIG-I13-6: one line editor for tickets (the composer), the finalized-edit banner
 * and resend offer, the delete sheet from the list and the detail, and Duplicar
 * ticket. Saves and deletes data: run it in CI or against a scratch database.
 */

/** After a hard navigation Next may hold a hidden streamed copy of a block (CI): act on the visible one. */
const visible = (locator: Locator) => locator.filter({ visible: true }).first();

for (const width of MOBILE_WIDTHS) {
  test.describe(`Ticket editor @${width}px`, () => {
    test.use({ viewport: { width, height: 812 } });
    test.setTimeout(420_000);

    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
      await ensureTenantCompany(page);
    });

    test('edit a finalized, shared ticket in the composer; resend; refuse below paid; old routes redirect', async ({
      page,
    }) => {
      const suffix = `${Date.now()}`.slice(-8);
      const clientName = `Cliente editor ${suffix}`;

      // A ticket with 3 lines and materials, finalized with a $1,000 partial payment, recibo shared.
      await openComposer(page);
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      await createClientInComposer(page, { name: clientName, phone: `991${suffix.slice(-7)}` });
      await addCustomComposerLine(page, { name: 'Instalación de evaporador', quantity: '1', price: '3000', materials: 2 });
      await addCustomComposerLine(page, { name: 'Recarga de gas', quantity: '2', price: '500' });
      await addCustomComposerLine(page, { name: 'Limpieza de condensador', quantity: '1', price: '800' });
      const { ticketId, openedUrls: opened } = await saveAndFinishComposer(page, {
        mode: 'partial',
        amount: 1000,
      });
      expect(opened.some((url) => url.startsWith('https://wa.me/'))).toBe(true);

      // The old routes land in the editor.
      await page.goto(`/tickets/${ticketId}/services`);
      await page.waitForURL(new RegExp(`/tickets/${ticketId}/edit$`), { timeout: 30_000 });
      await expect(page.getByRole('list', { name: 'Servicios del ticket' }).getByTestId('composer-line-row')).toHaveCount(3, {
        timeout: 15_000,
      });

      // Finalized: banner with the share date, client and date locked, Antes in the sticky bar.
      const banner = visible(page.getByTestId('composer-finalized-banner'));
      await expect(banner).toContainText('Este ticket ya se finalizó y el recibo se compartió el');
      await expect(banner).toContainText('Si cambias el total, al guardar te ofrecemos reenviar el recibo nuevo.');
      await page.getByTestId('composer-party-card').getByRole('button', { name: 'Cambiar' }).click();
      await expect(page.getByRole('combobox', { name: 'Cliente' })).toBeDisabled();
      await page.getByRole('button', { name: 'Listo', exact: true }).click();
      const hint = visible(page.getByTestId('composer-sticky-hint'));
      await expect(hint).toHaveText(/^Antes \$[\d,]+\.\d{2} · \+\$0\.00$/);
      await expectNoPageOverflow(page, 'editor');

      // The line sheet in edit mode: materials come back, removing shows Deshacer.
      const rows = page.getByRole('list', { name: 'Servicios del ticket' }).getByTestId('composer-line-row');
      // Rows with materials hold a materials toggle in the middle (ZIG-18): click the name line.
      await rows.first().click({ position: { x: 12, y: 12 } });
      const sheet = page.getByRole('dialog', { name: 'Editar servicio' });
      await expect(sheet.getByTestId('composer-line-material-rows').getByRole('listitem')).toHaveCount(2);
      await sheet.getByRole('spinbutton', { name: 'Cantidad del servicio' }).fill('2');
      await sheet.getByRole('button', { name: /^Agregar al (ticket|presupuesto)$/ }).click();
      await expect(sheet).toBeHidden({ timeout: 10_000 });
      // Quitar a line: gone, with Deshacer; undo brings it back.
      await rows.nth(2).click();
      await page.getByRole('dialog', { name: 'Editar servicio' }).getByRole('button', { name: 'Quitar este servicio' }).click();
      await expect(rows).toHaveCount(2);
      await page.getByRole('button', { name: 'Deshacer' }).click();
      await expect(rows).toHaveCount(3);
      await expect(hint).toHaveText(/^Antes \$[\d,]+\.\d{2} · \+\$[\d,]+\.\d{2}$/);

      // Below what is paid: Guardar waits. Remove two lines so the total drops under $1,000.
      await rows.nth(0).click({ position: { x: 12, y: 12 } });
      const dialog = page.getByRole('dialog', { name: 'Editar servicio' });
      await dialog.getByRole('button', { name: 'Quitar este servicio' }).click();
      await expect(rows).toHaveCount(2);
      await rows.nth(0).click({ position: { x: 12, y: 12 } });
      await page.getByRole('dialog', { name: 'Editar servicio' }).getByRole('button', { name: 'Quitar este servicio' }).click();
      await expect(rows).toHaveCount(1);
      await expect(page.getByTestId('composer-sticky-hint')).toHaveText('Abajo de lo ya pagado ($1,000.00)');
      await expect(page.getByRole('button', { name: /^Guardar cambios$/ }).first()).toBeDisabled();
      await expectInsideViewport(page, page.getByTestId('composer-sticky-total'), 'sticky total');

      // Deshacer brings a line back (two toasts are up: take the first), and Guardar is enabled again.
      await page.getByRole('button', { name: 'Deshacer' }).first().click();
      await expect(rows).toHaveCount(2);
      await expect(page.getByRole('button', { name: /^Guardar cambios$/ }).first()).toBeEnabled({ timeout: 15_000 });
      await page.getByRole('button', { name: /^Guardar cambios$/ }).first().click();

      // The detail offers to resend the new recibo; Reenviar opens the share (WhatsApp in headless).
      await page.waitForURL(new RegExp(`/tickets/${ticketId}\\?reenviar=1$`), { timeout: 60_000 });
      await page.evaluate(() => {
        (window as unknown as { __openedUrls: string[] }).__openedUrls = [];
        window.open = ((url?: string | URL) => {
          (window as unknown as { __openedUrls: string[] }).__openedUrls.push(String(url));
          return null;
        }) as typeof window.open;
      });
      const resend = page.getByRole('dialog', { name: '¿Reenviar el recibo nuevo?' });
      await expect(resend).toBeVisible({ timeout: 15_000 });
      await resend.getByRole('button', { name: 'Reenviar recibo' }).click();
      await expect
        .poll(
          () =>
            page.evaluate(() =>
              (window as unknown as { __openedUrls: string[] }).__openedUrls.some((url) =>
                url.startsWith('https://wa.me/'),
              ),
            ),
          { timeout: 60_000 },
        )
        .toBe(true);
      await expect(resend).toBeHidden({ timeout: 15_000 });
      await expect(page).toHaveURL(new RegExp(`/tickets/${ticketId}$`));
      // The hero reflects the edit: still owing, with the paid amount unchanged.
      await expect(visible(page.getByTestId('ticket-hero-paid'))).toContainText('Pagado $1,000.00 de');
    });

    test('delete sheet from the list and the detail, and Duplicar ticket', async ({ page }) => {
      const suffix = `${Date.now()}`.slice(-8);
      const clientName = `Cliente borrar ${suffix}`;

      await openComposer(page);
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      await createClientInComposer(page, { name: clientName, phone: `992${suffix.slice(-7)}` });
      await addCustomComposerLine(page, { name: 'Servicio de prueba A', quantity: '1', price: '1500', materials: 1 });
      await addCustomComposerLine(page, { name: 'Servicio de prueba B', quantity: '2', price: '250' });
      const { ticketId: firstId } = await saveAndFinishComposer(
        page,
        { mode: 'partial', amount: 500 },
        { send: false },
      );

      // From the list: the row menu opens the same sheet, Conservar keeps the ticket.
      await page.goto('/tickets');
      const search = page.getByPlaceholder('Cliente, número de ticket o teléfono');
      await search.fill(suffix);
      // The debounced search reloads the list (cards remount while it loads): wait for the result.
      await expect(page.getByText('1 de 1 tickets')).toBeVisible({ timeout: 20_000 });
      const card = visible(page.getByRole('button', { name: new RegExp(`^(Ver|Editar) ticket ${firstId}$`) }));
      await expect(card).toBeVisible({ timeout: 15_000 });
      await card.getByRole('button', { name: `Más acciones del ticket ${firstId}` }).click();
      await page.getByRole('menuitem', { name: `Eliminar ticket ${firstId}` }).click();
      const listSheet = page.getByRole('dialog', { name: /¿Eliminar el ticket (?:#\d+|[A-Z0-9]+-\d+)\?/ });
      await expect(listSheet).toBeVisible();
      await expect(listSheet).toContainText(clientName);
      await expect(listSheet).toContainText('$2,251.00');
      await expect(listSheet).toContainText('Tiene pagos registrados por $500.00');
      await expect(listSheet).not.toContainText(/papelera/i);
      await listSheet.getByRole('button', { name: 'Conservar' }).click();
      await expect(listSheet).toBeHidden();
      await expect(card).toBeVisible();

      // Duplicar ticket from the detail: the composer opens prefilled; saving makes a new ticket.
      await page.goto(`/tickets/${firstId}`);
      await visible(page.getByRole('button', { name: 'Más acciones del ticket' })).click();
      await page.getByRole('menuitem', { name: 'Duplicar ticket' }).click();
      await page.waitForURL(/\/tickets\/create$/, { timeout: 30_000 });
      const copyRows = page.getByRole('list', { name: 'Servicios del ticket' }).getByTestId('composer-line-row');
      await expect(copyRows).toHaveCount(2, { timeout: 15_000 });
      await expect(page.getByTestId('composer-party-card')).toContainText(clientName);
      await expect(page.getByTestId('composer-sticky-hint')).toHaveText('2 servicios · 1 material');
      const secondId = await saveComposer(page);
      expect(secondId).not.toBe(firstId);

      // The copy starts clean: no payments, no origin presupuesto.
      await page.goto(`/tickets/${secondId}`);
      await expect(visible(page.getByTestId('ticket-status-pill'))).toHaveText('En proceso', { timeout: 15_000 });
      await expect(page.getByTestId('ticket-payment-row')).toHaveCount(0);

      // From the detail: the sheet names the payments and deletes the ticket.
      await visible(page.getByRole('button', { name: 'Más acciones del ticket' })).click();
      await page.getByRole('menuitem', { name: 'Eliminar ticket' }).click();
      const detailSheet = page.getByRole('dialog', { name: /¿Eliminar el ticket (?:#\d+|[A-Z0-9]+-\d+)\?/ });
      await expect(detailSheet).toBeVisible();
      await expect(detailSheet).toContainText(clientName);
      await detailSheet.getByRole('button', { name: 'Eliminar ticket' }).click();
      await page.waitForURL(/\/tickets$/, { timeout: 60_000 });

      // Delete the first from the list row too.
      await page.getByPlaceholder('Cliente, número de ticket o teléfono').fill(suffix);
      await expect(page.getByText('1 de 1 tickets')).toBeVisible({ timeout: 20_000 });
      const firstCard = visible(page.getByRole('button', { name: new RegExp(`^(Ver|Editar) ticket ${firstId}$`) }));
      await expect(firstCard).toBeVisible({ timeout: 15_000 });
      await firstCard.getByRole('button', { name: `Más acciones del ticket ${firstId}` }).click();
      await page.getByRole('menuitem', { name: `Eliminar ticket ${firstId}` }).click();
      await page.getByRole('dialog', { name: /¿Eliminar el ticket (?:#\d+|[A-Z0-9]+-\d+)\?/ }).getByRole('button', { name: 'Eliminar ticket' }).click();
      await expect(firstCard).toHaveCount(0, { timeout: 15_000 });
    });
  });
}
