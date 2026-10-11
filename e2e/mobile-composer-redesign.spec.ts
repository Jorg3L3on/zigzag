import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import {
  addComposerLine,
  createClientInComposer,
  openComposer,
} from './helpers/ticket-composer';

/**
 * ZIG-I13-2: the composer and line sheet as drawn in the approved canvas
 * (Main / LineSheet), at 375px and 333px with a heavy fixture: 8 lines with
 * long names, a $1.2M custom line and 5 materials on one line. Nothing is
 * saved: the draft stays local, and the spec only needs a signed-in tenant.
 */

const LINES_LABEL = 'Servicios del ticket';
const LONG_NAMES = [
  'Mantenimiento correctivo de unidad manejadora de aire UMA-03 con cambio de rodamientos y banda',
  'Suministro e instalación de termostato inteligente Wi-Fi con programación semanal y sensor remoto',
  'Recargo por trabajo nocturno y en fin de semana en área de quirófanos (35%)',
  'X'.repeat(100),
  'Revisión de fugas en línea de succión',
  'Limpieza de condensadores azotea',
];

const addCustomLine = async (
  page: Page,
  { name, quantity, price, materials = 0 }: { name: string; quantity: string; price: string; materials?: number },
) => {
  await page.getByRole('button', { name: 'Agregar servicio' }).click();
  const sheet = page.getByRole('dialog', { name: 'Agregar servicio' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('radio', { name: /Nuevo/ }).click();
  await sheet.getByLabel('Nombre del servicio').fill(name);
  await sheet.getByRole('spinbutton', { name: 'Cantidad del servicio' }).fill(quantity);
  await sheet.getByRole('spinbutton', { name: 'Precio del servicio' }).fill(price);
  for (let i = 1; i <= materials; i += 1) {
    await sheet.getByRole('button', { name: 'Agregar material' }).click();
    const step = page.getByRole('dialog', { name: 'Agregar material' });
    await step.getByRole('radio', { name: /Nuevo/ }).click();
    await step.getByLabel('Nombre del material').fill(`Material de prueba número ${i} con nombre largo`);
    await step.getByLabel('Cantidad').fill('2');
    await step.getByLabel(/^Precio/).fill('125.5');
    await step.getByRole('button', { name: 'Agregar material' }).click();
    await expect(step.getByLabel('Nombre del material')).toBeHidden({ timeout: 10_000 });
  }
  await sheet.getByRole('button', { name: 'Guardar línea' }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
};

/** Polls: bottom sheets spring in, so the first frames are still below the fold. */
const expectInsideViewport = async (page: Page, locator: ReturnType<Page['locator']>, label: string) => {
  const view = page.viewportSize()!;
  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox();
        if (!box) return 'not rendered';
        if (box.x < -1) return `left ${box.x}`;
        if (box.x + box.width > view.width + 1) return `right ${box.x + box.width}`;
        if (box.y + box.height > view.height + 1) return `bottom ${box.y + box.height}`;
        return 'inside';
      },
      { message: `${label} inside the viewport`, timeout: 5_000 },
    )
    .toBe('inside');
};

const expectNoPageOverflow = async (page: Page, label: string) => {
  const extra = await page.evaluate(
    () => document.documentElement.scrollWidth - Math.ceil(window.visualViewport?.width ?? window.innerWidth),
  );
  expect(extra, `${label}: document wider than the viewport`).toBeLessThanOrEqual(0);
};

for (const width of [375, 333]) {
  test.describe(`Composer redesign @${width}px`, () => {
    test.use({ viewport: { width, height: 812 } });
    test.setTimeout(240_000);

    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
      await ensureTenantCompany(page);
      // A previous run's draft would change the fixture.
      await page.goto('/tickets/create');
      await page.evaluate(() => window.localStorage.clear());
    });

    test('rows, client card, sticky bar and line sheet match the canvas', async ({ page }) => {
      const suffix = `${Date.now()}`.slice(-8);
      await openComposer(page);
      await createClientInComposer(page, { name: `Cliente rediseño ${suffix}`, phone: `998${suffix.slice(-7)}` });

      // Client + date fold into one card; Cambiar reopens the picker.
      const card = page.getByTestId('composer-party-card');
      await expect(card).toContainText(`Cliente rediseño ${suffix}`);
      await expect(page.getByRole('combobox', { name: 'Cliente' })).toHaveCount(0);
      await expect(card.getByRole('button', { name: 'Cambiar' })).toBeVisible();

      await addComposerLine(page, { quantity: 2, price: 4200 }, 0, LINES_LABEL);
      for (const [index, name] of LONG_NAMES.entries()) {
        await addCustomLine(page, {
          name,
          quantity: String(index + 1),
          price: '3450',
          materials: index === 0 ? 5 : 0,
        });
      }
      await addCustomLine(page, { name: 'Recargo especial', quantity: '1', price: '1234567.89' });

      const lines = page.getByRole('list', { name: LINES_LABEL });
      const rows = lines.getByTestId('composer-line-row');
      await expect(rows).toHaveCount(8);

      // No ⋮ menu, no Nuevo pill; amounts whole and inside the viewport.
      await expect(page.getByRole('button', { name: /^Opciones de/ })).toHaveCount(0);
      await expect(lines.getByText('Nuevo', { exact: true })).toHaveCount(0);
      await expect(rows.nth(1).getByTestId('document-line-meta')).toContainText('5 materiales');
      for (let i = 0; i < 8; i += 1) {
        const row = rows.nth(i);
        await row.scrollIntoViewIfNeeded();
        const amount = row.getByTestId('document-line-amount');
        await expect(amount).toBeVisible();
        const [rowBox, amountBox] = [await row.boundingBox(), await amount.boundingBox()];
        expect(amountBox!.x + amountBox!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width + 1);
        // Never squeezed: a one-line amount.
        expect(amountBox!.height).toBeLessThan(30);
      }
      await expectNoPageOverflow(page, 'composer');

      // Sticky bar: counts over the total, Guardar.
      await expect(page.getByTestId('composer-sticky-hint')).toHaveText('8 servicios · 5 materiales');
      const save = page.getByRole('button', { name: /^Guardar( ticket)?$/ }).first();
      await expectInsideViewport(page, save, 'Guardar');
      await expectInsideViewport(page, page.getByTestId('composer-sticky-total'), 'sticky total');

      // Tapping the long-name row opens the sheet in edit mode with the 5 materials.
      await rows.nth(1).click();
      const sheet = page.getByRole('dialog', { name: 'Editar servicio' });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByTestId('composer-line-headline')).toContainText('Mantenimiento correctivo');
      await expect(sheet.getByTestId('composer-line-header')).toContainText('Fuera del catálogo · Cambiar servicio');
      await expect(sheet.getByRole('radio', { name: /Nuevo/ })).toHaveCount(0);

      // The footer stays put with 5 materials: subtotal and buttons are on screen.
      await expect(sheet.getByTestId('composer-line-material-rows').getByRole('listitem')).toHaveCount(5);
      await expectInsideViewport(page, sheet.getByTestId('composer-line-subtotal'), 'subtotal');
      await expectInsideViewport(page, sheet.getByRole('button', { name: 'Guardar línea' }), 'Guardar línea');
      await expectInsideViewport(page, sheet.getByRole('button', { name: 'Cancelar' }), 'Cancelar');
      await expect(sheet.getByTestId('composer-line-breakdown')).toContainText('Materiales $1,255.00');
      await expectNoPageOverflow(page, 'line sheet');

      // Qty and price side by side, price without −/+.
      const qty = await sheet.getByRole('spinbutton', { name: 'Cantidad del servicio' }).boundingBox();
      const price = await sheet.getByRole('spinbutton', { name: 'Precio del servicio' }).boundingBox();
      expect(Math.abs(qty!.y - price!.y)).toBeLessThan(4);
      await expect(sheet.getByRole('button', { name: 'Aumentar precio del servicio' })).toHaveCount(0);

      // Materials: remove with Deshacer.
      const materialName = 'Material de prueba número 1 con nombre largo';
      await sheet.getByRole('button', { name: `Quitar ${materialName}` }).click();
      await expect(sheet.getByTestId('composer-line-material-rows').getByRole('listitem')).toHaveCount(4);
      await page.getByRole('button', { name: 'Deshacer' }).click();
      await expect(sheet.getByTestId('composer-line-material-rows').getByRole('listitem')).toHaveCount(5);

      // Quitar this line: gone at once, Deshacer restores it.
      await sheet.getByRole('button', { name: 'Quitar este servicio' }).click();
      await expect(sheet).toBeHidden({ timeout: 10_000 });
      await expect(rows).toHaveCount(7);
      await page.getByRole('button', { name: 'Deshacer' }).click();
      await expect(rows).toHaveCount(8);
      await expect(rows.nth(1).getByTestId('document-line-meta')).toContainText('5 materiales');
    });

    test('a catalog line shows Del catálogo · Cambiar servicio and hides the Nuevo switch', async ({ page }) => {
      const suffix = `${Date.now()}`.slice(-8);
      await openComposer(page);
      await createClientInComposer(page, { name: `Cliente catálogo ${suffix}`, phone: `997${suffix.slice(-7)}` });
      const serviceName = await addComposerLine(page, { quantity: 2, price: 2100 }, 0, LINES_LABEL);

      await page.getByRole('list', { name: LINES_LABEL }).getByTestId('composer-line-row').first().click();
      const sheet = page.getByRole('dialog', { name: 'Editar servicio' });
      await expect(sheet.getByTestId('composer-line-headline')).toHaveText(serviceName);
      await expect(sheet.getByTestId('composer-line-header')).toContainText('Del catálogo · Cambiar servicio');
      await expect(sheet.getByRole('radio', { name: /Nuevo/ })).toHaveCount(0);
      await expect(sheet.getByRole('combobox', { name: 'Servicio' })).toHaveCount(0);

      // Cambiar servicio brings the picker and the switch back.
      await sheet.getByRole('button', { name: 'Cambiar servicio' }).click();
      await expect(sheet.getByRole('combobox', { name: 'Servicio' })).toBeVisible();
      await expect(sheet.getByRole('radio', { name: /Nuevo/ })).toBeVisible();
      await expect(sheet.getByRole('button', { name: 'Guardar línea' })).toBeDisabled();
      await sheet.getByRole('button', { name: 'Cancelar' }).click();
    });
  });
}
