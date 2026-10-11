import { expect, type Page } from '@playwright/test';

/** Nuevo ticket composer (ZIG-I2-4) helpers shared by core-flow specs. */

export const openComposer = async (page: Page) => {
  await page.goto('/tickets/create');
  await expect(
    page.getByRole('heading', { name: 'Cliente', exact: true }),
  ).toBeVisible({ timeout: 15_000 });
};

export const createClientInComposer = async (
  page: Page,
  { name, phone }: { name: string; phone: string },
) => {
  await page.getByRole('button', { name: 'Nuevo cliente' }).first().click();
  const clientDialog = page.getByRole('dialog', { name: 'Nuevo cliente' });
  await expect(clientDialog).toBeVisible();
  await clientDialog.getByLabel('Nombre').fill(name);
  await clientDialog.getByLabel('Teléfono').fill(phone);
  await clientDialog.getByRole('button', { name: 'Crear' }).click();

  const clientCreateError = page.getByText(
    /Error al crear el cliente|Selecciona una empresa/,
  );
  await Promise.race([
    expect(clientDialog).toBeHidden({ timeout: 30_000 }),
    clientCreateError
      .waitFor({ state: 'visible', timeout: 30_000 })
      .then(async () => {
        throw new Error(
          `Client create failed: ${await clientCreateError.textContent()}`,
        );
      }),
  ]);
  // Once a client is chosen, client and date fold into a card (ZIG-I13-2).
  await expect(page.getByTestId('composer-party-card')).toContainText(name);
};

export const addComposerLine = async (
  page: Page,
  { quantity, price }: { quantity: number; price: number },
  optionIndex = 0,
  linesLabel = 'Servicios del ticket',
) => {
  await page.getByRole('button', { name: 'Agregar servicio' }).click();
  const sheet = page.getByRole('dialog', { name: 'Agregar servicio' });
  await expect(sheet).toBeVisible();

  await sheet.getByRole('combobox', { name: 'Servicio' }).click();
  const listbox = page.getByRole('listbox', { name: 'Servicio' });
  await expect(listbox).toBeVisible({ timeout: 15_000 });
  const optionCount = await listbox.getByRole('option').count();
  const option = listbox
    .getByRole('option')
    .nth(Math.min(optionIndex, Math.max(optionCount - 1, 0)));
  await expect(option).toBeVisible();
  const optionText = (await option.textContent())?.trim() ?? '';
  const serviceName = optionText.split(' · ')[0];
  expect(serviceName).toBeTruthy();
  await option.click();

  // A catalog service can prefill default materials (ZIG-I10). These flows
  // price the service alone, so clear them; mobile-materiales covers them.
  const prefilled = sheet
    .getByTestId('composer-line-material-rows')
    .getByRole('button', { name: /^Quitar / });
  while ((await prefilled.count()) > 0) {
    await prefilled.first().click();
  }

  await sheet
    .getByRole('spinbutton', { name: 'Cantidad del servicio' })
    .fill(String(quantity));
  await sheet
    .getByRole('spinbutton', { name: 'Precio del servicio' })
    .fill(String(price));
  await sheet.getByRole('button', { name: 'Guardar línea' }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
  await expect(
    page
      .getByRole('list', { name: linesLabel })
      .getByText(serviceName)
      .first(),
  ).toBeVisible();
  return serviceName;
};

export const saveComposer = async (page: Page) => {
  const save = page.getByRole('button', { name: /^Guardar( ticket)?$/ }).first();
  await expect(save).toBeEnabled();
  await save.click();
  await page.waitForURL(/\/tickets\/\d+\/listo$/, { timeout: 60_000 });
  const ticketId = page.url().match(/\/tickets\/(\d+)/)?.[1];
  expect(ticketId).toBeTruthy();
  return ticketId!;
};

/**
 * Creation review (ZIG-I2-5): choose the payment and tap Finalizar y compartir.
 * window.open is stubbed so the WhatsApp fallback never leaves the app in tests.
 */
export const finishOnReview = async (
  page: Page,
  ticketId: string,
  payment: { mode: 'full' } | { mode: 'partial'; amount: number } | { mode: 'pending' },
) => {
  await expect(
    page.getByText(`Ticket #${ticketId} guardado`).filter({ visible: true }).first(),
  ).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => {
    (window as unknown as { __openedUrls: string[] }).__openedUrls = [];
    window.open = ((url?: string | URL) => {
      (window as unknown as { __openedUrls: string[] }).__openedUrls.push(String(url));
      return null;
    }) as typeof window.open;
  });

  const label =
    payment.mode === 'full' ? 'Todo' : payment.mode === 'partial' ? 'Una parte' : 'Nada aún';
  await page.getByRole('radio', { name: label, exact: true }).click();
  if (payment.mode === 'partial') {
    await page.getByLabel('Cuánto pagó').fill(String(payment.amount));
  }

  await page.getByRole('button', { name: 'Finalizar y compartir' }).first().click();

  // Reminders are ticked on this screen and saved before the share sheet
  // (ZIG-I13-3): no dialog to answer.
  const heading = page.getByText(`Ticket #${ticketId} finalizado`).filter({ visible: true }).first();
  await expect(heading).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: /Compartir recibo/ }).first()).toBeEnabled({
    timeout: 60_000,
  });

  return page.evaluate(
    () => (window as unknown as { __openedUrls: string[] }).__openedUrls,
  );
};

/**
 * Inline line (ZIG-I5): Nuevo mode in the line sheet, typed name and price,
 * optionally with Guardar en mi catálogo on. Nothing is written until save.
 */
export const addInlineComposerLine = async (
  page: Page,
  {
    name,
    price,
    quantity = 1,
    saveToCatalog = false,
  }: { name: string; price: number; quantity?: number; saveToCatalog?: boolean },
  linesLabel = 'Servicios del ticket',
) => {
  await page.getByRole('button', { name: 'Agregar servicio' }).click();
  const sheet = page.getByRole('dialog', { name: 'Agregar servicio' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('radio', { name: /Nuevo/ }).click();
  await sheet.getByLabel('Nombre del servicio').fill(name);
  const toggle = sheet.getByRole('switch', { name: /Guardar en mi catálogo/ });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  if (saveToCatalog) await toggle.click();
  await sheet
    .getByRole('spinbutton', { name: 'Cantidad del servicio' })
    .fill(String(quantity));
  await sheet
    .getByRole('spinbutton', { name: 'Precio del servicio' })
    .fill(String(price));
  await sheet.getByRole('button', { name: 'Guardar línea' }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
  const lines = page.getByRole('list', { name: linesLabel });
  await expect(lines.getByText(name).first()).toBeVisible();
  return name;
};

/**
 * A typed-in (Nuevo) line with optional inline materials: the heavy fixtures of
 * the ZIG-I13 specs. Nothing is saved until the composer is saved.
 */
export const addCustomComposerLine = async (
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
export const expectInsideViewport = async (page: Page, locator: ReturnType<Page['locator']>, label: string) => {
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

export const expectNoPageOverflow = async (page: Page, label: string) => {
  const extra = await page.evaluate(
    () => document.documentElement.scrollWidth - Math.ceil(window.visualViewport?.width ?? window.innerWidth),
  );
  expect(extra, `${label}: document wider than the viewport`).toBeLessThanOrEqual(0);
};

