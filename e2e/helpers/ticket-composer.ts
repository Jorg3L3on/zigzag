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
  await expect(page.getByRole('combobox', { name: 'Cliente' })).toContainText(
    name,
  );
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
  await sheet.getByRole('button', { name: 'Agregar', exact: true }).click();
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
  const save = page.getByRole('button', { name: 'Guardar ticket' }).first();
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
    page.getByRole('heading', { name: `Ticket #${ticketId} guardado` }),
  ).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => {
    (window as unknown as { __openedUrls: string[] }).__openedUrls = [];
    window.open = ((url?: string | URL) => {
      (window as unknown as { __openedUrls: string[] }).__openedUrls.push(String(url));
      return null;
    }) as typeof window.open;
  });

  const label =
    payment.mode === 'full'
      ? /Pagado completo/
      : payment.mode === 'partial'
        ? /Pago parcial/
        : /Pendiente/;
  await page.getByRole('radio', { name: label }).click();
  if (payment.mode === 'partial') {
    await page.getByLabel('Cuánto pagó').fill(String(payment.amount));
  }

  await page.getByRole('button', { name: 'Finalizar y compartir' }).first().click();
  await expect(
    page.getByRole('heading', { name: `Ticket #${ticketId} finalizado` }),
  ).toBeVisible({ timeout: 60_000 });

  const schedulesDialog = page.getByRole('dialog', {
    name: 'Recordatorios de servicio',
  });
  await expect(schedulesDialog).toBeVisible({ timeout: 30_000 });
  // Reminders come first; the receipt is shared once the dialog is answered (ZIG-I12).
  await schedulesDialog.getByRole('button', { name: 'Omitir' }).click();
  await expect(schedulesDialog).toBeHidden();
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
  await sheet.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
  const lines = page.getByRole('list', { name: linesLabel });
  await expect(lines.getByText(name).first()).toBeVisible();
  return name;
};
