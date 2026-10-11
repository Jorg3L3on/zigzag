import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import {
  addComposerLine,
  addCustomComposerLine,
  createClientInComposer,
  expectInsideViewport,
  expectNoPageOverflow,
  openComposer,
  saveComposer,
} from './helpers/ticket-composer';

/**
 * ZIG-I13-3: the saved-ticket screen as drawn in the canvas (Listo), with the
 * heavy ticket: 8 lines (one catalog, one $1.2M custom) and 21 materials.
 * Saves a ticket: run it in CI or against a scratch database.
 */

const LONG_NAMES = [
  'Mantenimiento correctivo de unidad manejadora de aire UMA-03 con cambio de rodamientos y banda',
  'Suministro e instalación de termostato inteligente Wi-Fi con programación semanal y sensor remoto',
  'Recargo por trabajo nocturno y en fin de semana en área de quirófanos (35%)',
  'X'.repeat(100),
  'Limpieza de condensadores azotea',
];

for (const width of [375, 333]) {
  test.describe(`Listo redesign @${width}px`, () => {
    test.use({ viewport: { width, height: 812 } });
    test.setTimeout(300_000);

    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
      await ensureTenantCompany(page);
    });

    test('payment first, summary folded, reminders inline, no PDF box', async ({ page }) => {
      const suffix = `${Date.now()}`.slice(-8);
      const clientName = `Cliente listo ${suffix}`;
      await openComposer(page);
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      await createClientInComposer(page, { name: clientName, phone: `996${suffix.slice(-7)}` });
      await addComposerLine(page, { quantity: 2, price: 4200 });
      const materialsPerLine = [5, 4, 4, 4, 4];
      for (const [index, name] of LONG_NAMES.entries()) {
        await addCustomComposerLine(page, {
          name,
          quantity: String(index + 1),
          price: '3450',
          materials: materialsPerLine[index],
        });
      }
      await addCustomComposerLine(page, { name: 'Recargo especial', quantity: '1', price: '1234567.89' });
      await addCustomComposerLine(page, { name: 'Visita de diagnóstico', quantity: '1', price: '500' });
      await expect(page.getByTestId('composer-sticky-hint')).toHaveText('8 servicios · 21 materiales');

      const ticketId = await saveComposer(page);
      await expect(page.getByText(`Ticket #${ticketId} guardado`).filter({ visible: true }).first()).toBeVisible({
        timeout: 15_000,
      });
      await page.evaluate(() => {
        (window as unknown as { __openedUrls: string[] }).__openedUrls = [];
        window.open = ((url?: string | URL) => {
          (window as unknown as { __openedUrls: string[] }).__openedUrls.push(String(url));
          return null;
        }) as typeof window.open;
      });

      // Check 1: with 8 lines and 21 materials the payment choice is on the first screen.
      const payHeading = page.getByRole('heading', { name: '¿Cómo pagó el cliente?' });
      await expect(payHeading).toBeVisible();
      const payBox = await payHeading.boundingBox();
      expect(payBox!.y, 'payment choice top must be inside the first screen').toBeLessThan(812);
      await expectInsideViewport(page, page.getByRole('radio', { name: 'Una parte' }), 'Una parte');

      // The Resumen: Total and a three-row summary with the fold.
      const summary = page.getByTestId('review-summary');
      await expect(summary).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ver los 8 servicios y 21 materiales' })).toBeVisible();
      await expect(page.getByTestId('recibo-summary')).toHaveCount(0);
      await expect(page.getByTestId('recibo-pdf-preview')).toHaveCount(0);
      await expect(page.locator('object')).toHaveCount(0);
      await expect(page.getByRole('link', { name: /Abrir PDF/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /Descargar PDF/ })).toBeVisible();
      await expectNoPageOverflow(page, 'listo');

      // Nothing preselected; Finalizar waits; partial shows the balance in the sticky bar.
      for (const radio of await page.getByRole('radio').all()) {
        await expect(radio).toHaveAttribute('aria-checked', 'false');
      }
      const finish = page.getByRole('button', { name: 'Finalizar y compartir' }).first();
      await expect(finish).toBeDisabled();
      await expect(page.getByTestId('review-sticky-amount').locator('xpath=preceding-sibling::p')).toHaveText('Total');
      await page.getByRole('radio', { name: 'Una parte' }).click();
      await page.getByLabel('Cuánto pagó').fill('500000');
      await expect(page.getByTestId('review-sticky-amount').locator('xpath=preceding-sibling::p')).toHaveText(
        'Saldo pendiente',
      );
      await expectInsideViewport(page, page.getByTestId('review-sticky-amount'), 'sticky amount');
      await expectInsideViewport(page, finish, 'Finalizar y compartir');

      // Reminders are inline: tick the catalog line and finalize.
      const reminders = page.getByTestId('listo-schedules');
      await expect(reminders).toBeVisible();
      await reminders.getByRole('checkbox').first().check();
      await expectNoPageOverflow(page, 'listo with reminders');
      await finish.click();

      // No Recordatorios dialog before or after sharing.
      await expect(page.getByText(`Ticket #${ticketId} finalizado`).filter({ visible: true }).first()).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByRole('dialog')).toHaveCount(0);
      // The share sheet (WhatsApp fallback in headless Chromium) opens after the reminders are saved.
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
      await expect(page.getByRole('button', { name: /Compartir recibo/ }).first()).toBeEnabled({
        timeout: 60_000,
      });

      // Finalized: Resumen with Pagado and Saldo, no payment choice, no reminders.
      await expect(page.getByTestId('review-summary')).toContainText('Pagado');
      await expect(page.getByRole('radio')).toHaveCount(0);
      await expect(page.getByTestId('listo-schedules')).toHaveCount(0);

      // The reminder ticked on this screen was saved with the client.
      await page.goto('/service-schedules');
      await expect(page.getByText(clientName).first()).toBeVisible({ timeout: 20_000 });
    });
  });
}
