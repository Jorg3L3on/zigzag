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
  expectInsideViewport,
  expectNoPageOverflow,
} from './helpers/ticket-composer';

/**
 * ZIG-I13-5: presupuesto detail as drawn in the canvas, and Duplicar from an
 * Abierto, a Convertido and a Cancelado presupuesto. Saves data: run it in CI or
 * against a scratch database.
 */

const LINES_LABEL = 'Servicios del presupuesto';
const CONDITIONS =
  '• 60% de anticipo, 40% contra entrega.\n• Entrega de 6 a 8 semanas después del anticipo.\n• Precios en MXN más IVA.\n• Vigencia sujeta a existencias.';

const CONCEPTS = [
  { name: 'Sustitución de sistema de aire acondicionado central con unidades manejadoras de aire', quantity: '1', price: '2855130', materials: 3 },
  { name: 'Desmontaje y disposición final de equipos obsoletos en azotea', quantity: '4', price: '8375', materials: 2 },
  { name: 'Póliza de mantenimiento preventivo trimestral', quantity: '4', price: '14500', materials: 2 },
  { name: 'X'.repeat(100), quantity: '1', price: '1200', materials: 0 },
];

const expectDraftOpened = async (page: Page) => {
  await page.waitForURL(/\/presupuestos\/create$/, { timeout: 30_000 });
  const rows = page.getByRole('list', { name: LINES_LABEL }).getByTestId('composer-line-row');
  await expect(rows).toHaveCount(CONCEPTS.length, { timeout: 15_000 });
  await expect(page.getByTestId('composer-sticky-hint')).toHaveText('4 servicios · 7 materiales');
  await expect(page.getByRole('textbox', { name: /Notas/ })).toHaveValue(CONDITIONS);
  await expect(page.getByTestId('composer-party-card')).toBeVisible();
};

for (const width of [375, 333]) {
  test.describe(`Presupuesto detail redesign @${width}px`, () => {
    test.use({ viewport: { width, height: 812 } });
    test.setTimeout(420_000);

    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
      await ensureTenantCompany(page);
    });

    test('detail layout, convert near the top, and Duplicar from every status', async ({ page }) => {
      const suffix = `${Date.now()}`.slice(-8);
      const clientName = `Cliente presupuesto ${suffix}`;

      await page.goto('/presupuestos/create');
      await page.evaluate(() => window.localStorage.clear());
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Cliente', exact: true })).toBeVisible({ timeout: 15_000 });
      await createClientInComposer(page, { name: clientName, phone: `994${suffix.slice(-7)}` });
      for (const concept of CONCEPTS) await addCustomComposerLine(page, concept);
      await page.getByRole('button', { name: '15 días' }).click();
      await page.getByRole('textbox', { name: /Notas/ }).fill(CONDITIONS);
      await page.getByRole('button', { name: /^Guardar( presupuesto)?$/ }).first().click();
      await page.waitForURL(/\/presupuestos\/\d+\/listo$/, { timeout: 60_000 });
      const firstId = page.url().match(/\/presupuestos\/(\d+)/)?.[1] as string;

      // Detail: the accept card with Convertir a ticket is on the first screen.
      await page.goto(`/presupuestos/${firstId}`);
      await expect(page.getByTestId('presupuesto-status').filter({ visible: true }).first()).toHaveText('Abierto', {
        timeout: 15_000,
      });
      const convert = page.getByTestId('presupuesto-accept').getByRole('button', { name: 'Convertir a ticket' });
      await expect(convert).toBeVisible();
      await expectInsideViewport(page, convert, 'Convertir a ticket');
      await expect(page.getByTestId('presupuesto-counts')).toHaveText('4 conceptos · 7 materiales');
      await expect(page.getByTestId('presupuesto-expires')).toContainText(/Vence el .* · quedan 1[45] días/);
      await expect(page.getByRole('heading', { name: 'Condiciones' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ver todas' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Conceptos' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ver los 4 conceptos y 7 materiales' })).toBeVisible();
      await expectNoPageOverflow(page, 'presupuesto detail');

      // Bottom row on the dock: Editar / Duplicar / Cancelar; share is the icon in the app bar.
      const row = page.getByTestId('presupuesto-actions');
      await expect(row.getByRole('link', { name: 'Editar' })).toBeVisible();
      await expect(row.getByRole('button', { name: 'Duplicar' })).toBeVisible();
      await expect(row.getByRole('button', { name: 'Cancelar presupuesto' })).toBeVisible();
      await expectInsideViewport(page, row, 'action row');
      await expect(
        page.getByTestId('mobile-app-bar').getByRole('button', { name: 'Compartir presupuesto' }),
      ).toBeVisible();

      // Duplicar from Abierto: the composer opens prefilled; saving makes a new presupuesto.
      await row.getByRole('button', { name: 'Duplicar' }).click();
      await expectDraftOpened(page);
      await page.getByRole('button', { name: /^Guardar( presupuesto)?$/ }).first().click();
      await page.waitForURL(/\/presupuestos\/\d+\/listo$/, { timeout: 60_000 });
      const secondId = page.url().match(/\/presupuestos\/(\d+)/)?.[1] as string;
      expect(secondId).not.toBe(firstId);

      // Convertido: convert the first one, then Duplicar still works.
      await page.goto(`/presupuestos/${firstId}`);
      await page.getByTestId('presupuesto-accept').getByRole('button', { name: 'Convertir a ticket' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Convertir a ticket' }).click();
      await page.waitForURL(/\/tickets\/\d+$/, { timeout: 60_000 });
      await page.goto(`/presupuestos/${firstId}`);
      await expect(page.getByTestId('presupuesto-status').filter({ visible: true }).first()).toHaveText('Convertido');
      await expect(page.getByTestId('presupuesto-accept')).toHaveCount(0);
      await expect(page.getByTestId('presupuesto-actions').getByRole('link', { name: 'Editar' })).toHaveCount(0);
      await page.getByTestId('presupuesto-actions').getByRole('button', { name: 'Duplicar' }).click();
      await expectDraftOpened(page);

      // Cancelado: cancel the second one, then Duplicar still works.
      await page.evaluate(() => window.localStorage.clear());
      await page.goto(`/presupuestos/${secondId}`);
      await page.getByTestId('presupuesto-actions').getByRole('button', { name: 'Cancelar presupuesto' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Cancelar presupuesto' }).click();
      await expect(page.getByTestId('presupuesto-status').filter({ visible: true }).first()).toHaveText('Cancelado', {
        timeout: 30_000,
      });
      await page.getByTestId('presupuesto-actions').getByRole('button', { name: 'Duplicar' }).click();
      await expectDraftOpened(page);
      await page.evaluate(() => window.localStorage.clear());
    });
  });
}
