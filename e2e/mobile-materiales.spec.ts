import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import { createClientInComposer } from './helpers/ticket-composer';

/**
 * ZIG-I10 Materiales on Pixel 5: a catalog service with two default materials
 * (Servicios form) → Nuevo presupuesto prefills them, one is removed and an
 * inline one added → review lists both with the right total → Convertir a
 * ticket → /tickets/[id]/services edits the line's materials and the total
 * follows. This spec saves data: run it in CI or against a scratch database,
 * never against production.
 */

const LINES_LABEL = 'Servicios del presupuesto';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const addServiceMaterial = async (
  page: Page,
  { name, unit, quantity, price }: { name: string; unit: string; quantity: string; price: string },
) => {
  await page.getByRole('button', { name: 'Agregar material' }).click();
  const sheet = page.getByRole('dialog', { name: 'Agregar material' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('combobox', { name: 'Nombre del material' }).fill(name);
  await sheet.getByRole('button', { name: unit, exact: true }).click();
  await sheet.getByLabel('Cantidad').fill(quantity);
  await sheet.getByLabel(/^Precio/).fill(price);
  await sheet.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
};

/** No horizontal overflow: the layout viewport never grows past what the user sees. */
const expectNoHorizontalOverflow = async (page: Page) => {
  const { scrollWidth, visualWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    visualWidth: window.visualViewport?.width ?? window.innerWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(Math.ceil(visualWidth));
};

const expectInsideViewport = async (page: Page, locator: Locator) => {
  const box = await locator.boundingBox();
  const width = await page.evaluate(() => window.visualViewport?.width ?? window.innerWidth);
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(Math.ceil(width));
};

test.describe('Materiales (mobile)', () => {
  test.setTimeout(300_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('service defaults → presupuesto → review → ticket services', async ({ page }) => {
    const suffix = Date.now().toString().slice(-8);
    const serviceName = `Instalación minisplit ${suffix}`;
    const gas = `Gas R410A ${suffix}`;
    const tube = `Tubo de cobre ${suffix}`;
    const inline = `Soporte de pared ${suffix}`;

    // 1. Servicios form: a service with two default materials.
    await page.goto('/services/new');
    await page.getByPlaceholder('Ej: Limpieza de oficinas').fill(serviceName);
    await page.getByPlaceholder('Describe el servicio...').fill('Incluye base');
    await page.getByPlaceholder('0.00').first().fill('3500');
    await addServiceMaterial(page, { name: gas, unit: 'kg', quantity: '1.5', price: '380' });
    await addServiceMaterial(page, { name: tube, unit: 'm', quantity: '3', price: '85' });
    const serviceRows = page.getByTestId('service-material-rows');
    await expect(serviceRows.getByText('1.5 kg × $380.00')).toBeVisible();
    await expect(serviceRows.getByText('3 m × $85.00')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: /Crear servicio/ }).click();
    await expect(page.getByText('Servicio creado correctamente')).toBeVisible({
      timeout: 30_000,
    });

    // The list shows the count; the edit page reloads them.
    await page.goto('/services');
    const card = page
      .locator('[data-testid="service-card-materials"]')
      .filter({ hasText: '2 materiales' })
      .first();
    await expect(card).toBeVisible({ timeout: 15_000 });

    // 2. Nuevo presupuesto at a narrow phone width: the service prefills its materials.
    await page.setViewportSize({ width: 333, height: 740 });
    await page.goto('/presupuestos/create');
    await expect(page.getByRole('heading', { name: 'Cliente', exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await createClientInComposer(page, {
      name: `Materiales ${suffix}`,
      phone: `966${suffix.slice(-7)}`,
    });
    await page.getByRole('button', { name: 'Agregar servicio' }).click();
    const sheet = page.getByRole('dialog', { name: 'Agregar servicio' });
    await sheet.getByRole('combobox', { name: 'Servicio' }).click();
    // The picker filters as you type.
    await page.keyboard.type(suffix);
    await page
      .getByRole('listbox', { name: 'Servicio' })
      .getByRole('option', { name: new RegExp(serviceName) })
      .click();
    const lineRows = sheet.getByTestId('composer-line-material-rows');
    await expect(lineRows.getByText(gas)).toBeVisible();
    await expect(lineRows.getByText(tube)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectInsideViewport(page, sheet.getByRole('button', { name: `Quitar ${tube}` }));

    // Remove the tube, add an inline material.
    await sheet.getByRole('button', { name: `Quitar ${tube}` }).click();
    await sheet.getByRole('button', { name: 'Agregar material' }).click();
    const step = page.getByRole('dialog', { name: 'Agregar material' });
    await step.getByRole('radio', { name: 'Nuevo' }).click();
    await step.getByLabel('Nombre del material').fill(inline);
    await step.getByRole('button', { name: 'pza', exact: true }).click();
    await step.getByLabel(/^Precio/).fill('320');
    await step.getByRole('button', { name: 'Agregar material' }).click();
    await expect(sheet.getByTestId('composer-line-breakdown')).toHaveText(
      `Servicio ${money(3500)} · Materiales ${money(890)}`,
    );
    await sheet.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(sheet).toBeHidden({ timeout: 10_000 });
    await expect(page.getByTestId('composer-total')).toHaveText(money(4390));
    await expectNoHorizontalOverflow(page);
    await expectInsideViewport(page, page.getByTestId('mobile-bottom-tab-bar'));
    await page.setViewportSize({ width: 393, height: 851 });

    const save = page.getByRole('button', { name: 'Guardar presupuesto' }).first();
    await save.click();
    await page.waitForURL(/\/presupuestos\/\d+\/listo$/, { timeout: 60_000 });
    const presupuestoId = page.url().match(/\/presupuestos\/(\d+)/)?.[1];

    // 3. Review: both materials under the line, total with materials.
    await expect(page.getByTestId('review-total')).toHaveText(money(4390), {
      timeout: 15_000,
    });
    const reviewLines = page.getByRole('list', { name: LINES_LABEL });
    const reviewMaterials = reviewLines.getByRole('list', { name: 'Materiales' });
    await expect(reviewMaterials.getByText(gas)).toBeVisible();
    await expect(reviewMaterials.getByText(inline)).toBeVisible();
    await expect(reviewMaterials.getByText(tube)).toHaveCount(0);

    // 4. Convert and edit the materials on the ticket's services page.
    await page.goto(`/presupuestos/${presupuestoId}`);
    await page.getByRole('button', { name: 'Convertir a ticket' }).first().click();
    await page.getByRole('alertdialog').getByRole('button', { name: /Convertir/ }).click();
    await page.waitForURL(/\/tickets\/\d+/, { timeout: 60_000 });
    const ticketId = page.url().match(/\/tickets\/(\d+)/)?.[1];
    await page.goto(`/tickets/${ticketId}/services`);
    const row = page.getByTestId('ticket-service-row').first();
    await expect(row.getByText(gas)).toBeVisible({ timeout: 15_000 });
    await row.getByRole('button', { name: /Opciones de/ }).click();
    await page.getByRole('menuitem', { name: /Materiales/ }).click();
    const materialsSheet = page.getByRole('dialog', { name: /Materiales de/ });
    await materialsSheet.getByRole('button', { name: `Quitar ${inline}` }).click();
    await materialsSheet.getByRole('button', { name: 'Guardar' }).click();
    await expect(row.getByText(inline)).toHaveCount(0, { timeout: 15_000 });
    // 3500 + 570
    await expect(page.getByText(money(4070)).first()).toBeVisible();
  });
});
