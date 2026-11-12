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
  await sheet.getByRole('button', { name: /^Agregar al (ticket|presupuesto)$/ }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
  await expect(
    page
      .getByRole('list', { name: linesLabel })
      .getByText(serviceName)
      .first(),
  ).toBeVisible();
  return serviceName;
};

export type ComposerPayment =
  | { mode: 'full' }
  | { mode: 'partial'; amount: number }
  | { mode: 'pending' };

const paymentLabel = (payment: ComposerPayment) =>
  payment.mode === 'full' ? 'Todo' : payment.mode === 'partial' ? 'Una parte' : 'Nada aún';

/** The desktop Terminar ticket card words the same choice as the canvas (PR #610). */
const paymentOptionLabel = (payment: ComposerPayment) =>
  payment.mode === 'full'
    ? /^(Todo|Pagó todo)$/
    : payment.mode === 'partial'
      ? /^(Una parte|Pagó una parte)$/
      : /^(Nada aún|Aún no paga)$/;

/** Guardar ticket without a payment: saved En proceso, lands on the detail (ZIG-I24-4). */
export const saveComposer = async (page: Page) => {
  const save = page.getByRole('button', { name: /^Guardar( ticket)?$/ }).first();
  await expect(save).toBeEnabled();
  await save.click();
  await page.waitForURL(/\/tickets\/\d+$/, { timeout: 60_000 });
  const ticketId = page.url().match(/\/tickets\/(\d+)/)?.[1];
  expect(ticketId).toBeTruthy();
  return ticketId!;
};

/** ¿Cómo pagó el cliente? (opcional) in Nuevo ticket (ZIG-I24-4). */
export const chooseComposerPayment = async (page: Page, payment: ComposerPayment) => {
  await page.getByRole('radio', { name: paymentLabel(payment), exact: true }).first().click();
  if (payment.mode === 'partial') {
    await page.getByLabel('Cuánto pagó').first().fill(String(payment.amount));
  }
};

const stubWindowOpen = (page: Page) =>
  page.evaluate(() => {
    const target = window as unknown as { __openedUrls?: string[] };
    if (target.__openedUrls) return;
    target.__openedUrls = [];
    window.open = ((url?: string | URL) => {
      target.__openedUrls!.push(String(url));
      return null;
    }) as typeof window.open;
  });

const readOpenedUrls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __openedUrls?: string[] }).__openedUrls ?? []);

/**
 * Guardar y terminar from Nuevo ticket (ZIG-I24-4): picks the payment, saves and
 * finishes, then answers the detail's "Ticket … terminado" prompt: Enviar
 * recibo (send, the default) or Ahora no. window.open is stubbed so the
 * WhatsApp fallback never leaves the app; its URLs come back with the id.
 */
export const saveAndFinishComposer = async (
  page: Page,
  payment: ComposerPayment,
  { send = true }: { send?: boolean } = {},
) => {
  await stubWindowOpen(page);
  await chooseComposerPayment(page, payment);
  const finish = page
    .getByRole('button', { name: /^(Guardar y terminar|Terminar)$/ })
    .filter({ visible: true })
    .first();
  await expect(finish).toBeEnabled();
  await finish.click();
  await page.waitForURL(/\/tickets\/\d+\?enviar=1$/, { timeout: 60_000 });
  const ticketId = page.url().match(/\/tickets\/(\d+)/)?.[1];
  expect(ticketId).toBeTruthy();

  const prompt = page.getByRole('dialog', { name: /Ticket (?:#\d+|[A-Z0-9]+-\d+) terminado/ });
  await expect(prompt).toBeVisible({ timeout: 30_000 });
  await stubWindowOpen(page);
  await prompt.getByRole('button', { name: send ? 'Enviar recibo' : 'Ahora no' }).click();
  await expect(prompt).toBeHidden({ timeout: 60_000 });
  return { ticketId: ticketId!, openedUrls: await readOpenedUrls(page) };
};

/**
 * Finish an En proceso ticket from its detail (Terminar ticket panel): pick the
 * payment, Terminar y generar recibo, skip the reminders dialog when it shows,
 * and wait until the panel is gone. The recibo download is accepted.
 */
export const finishOnDetail = async (page: Page, ticketId: string, payment: ComposerPayment) => {
  if (!new RegExp(`/tickets/${ticketId}(\\?|$)`).test(page.url())) {
    await page.goto(`/tickets/${ticketId}`);
  }
  const panel = page.locator('#finalizar').filter({ visible: true }).first();
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await panel.getByRole('radio', { name: paymentOptionLabel(payment) }).click();
  if (payment.mode === 'partial') {
    await panel.getByLabel('Cuánto pagó').fill(String(payment.amount));
  }
  await panel.getByRole('button', { name: 'Terminar y generar recibo' }).click();
  const skip = page.getByRole('dialog').getByRole('button', { name: 'Omitir' });
  await Promise.race([
    skip.waitFor({ state: 'visible', timeout: 15_000 }).then(() => skip.click()),
    panel.waitFor({ state: 'detached', timeout: 15_000 }),
  ]).catch(() => undefined);
  await expect(page.locator('#finalizar').filter({ visible: true })).toHaveCount(0, { timeout: 60_000 });
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
  await sheet.getByRole('radio', { name: /Escribir/ }).click();
  await sheet.getByLabel('Nombre del servicio').fill(name);
  const toggle = sheet.getByRole('switch', { name: /Guardar en mis servicios/ });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  if (saveToCatalog) await toggle.click();
  await sheet
    .getByRole('spinbutton', { name: 'Cantidad del servicio' })
    .fill(String(quantity));
  await sheet
    .getByRole('spinbutton', { name: 'Precio del servicio' })
    .fill(String(price));
  await sheet.getByRole('button', { name: /^Agregar al (ticket|presupuesto)$/ }).click();
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
  await sheet.getByRole('radio', { name: /Escribir/ }).click();
  await sheet.getByLabel('Nombre del servicio').fill(name);
  await sheet.getByRole('spinbutton', { name: 'Cantidad del servicio' }).fill(quantity);
  await sheet.getByRole('spinbutton', { name: 'Precio del servicio' }).fill(price);
  for (let i = 1; i <= materials; i += 1) {
    await sheet.getByRole('button', { name: 'Agregar material' }).click();
    // Phones: a nested step of the sheet. Desktop (ZIG-I24-2): a form inside the side panel.
    const step = page
      .getByRole('dialog', { name: 'Agregar material' })
      .or(sheet.getByRole('group', { name: 'Agregar material' }));
    await step.getByRole('radio', { name: /Escribir/ }).click();
    await step.getByLabel('Nombre del material').fill(`Material de prueba número ${i} con nombre largo`);
    await step.getByLabel('Cantidad').fill('2');
    await step.getByLabel(/^Precio/).fill('125.5');
    await step.getByRole('button', { name: 'Agregar material' }).click();
    await expect(step.getByLabel('Nombre del material')).toBeHidden({ timeout: 10_000 });
  }
  await sheet.getByRole('button', { name: /^Agregar al (ticket|presupuesto)$/ }).click();
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


const HEAVY_NAMES = [
  'Mantenimiento correctivo de unidad manejadora de aire UMA-03 con cambio de rodamientos y banda',
  'Suministro e instalación de termostato inteligente Wi-Fi con programación semanal y sensor remoto',
  'Recargo por trabajo nocturno y en fin de semana en área de quirófanos (35%)',
  'X'.repeat(100),
  'Limpieza de condensadores azotea',
];

/**
 * The heavy document of the ZIG-I13 specs: 8 lines (5 long names with 5/4/4/4/4
 * materials, a $1,234,567.89 line and a short one, plus one catalog line when
 * `catalog` is set) and 21 materials in all.
 */
export const addHeavyLines = async (
  page: Page,
  { catalog = true, linesLabel }: { catalog?: boolean; linesLabel?: string } = {},
) => {
  if (catalog) {
    await addComposerLine(page, { quantity: 2, price: 4200 }, 0, linesLabel);
  } else {
    await addCustomComposerLine(page, { name: 'Instalación mini-split', quantity: '2', price: '4200' });
  }
  const materialsPerLine = [5, 4, 4, 4, 4];
  for (const [index, name] of HEAVY_NAMES.entries()) {
    await addCustomComposerLine(page, {
      name,
      quantity: String(index + 1),
      price: '3450',
      materials: materialsPerLine[index],
    });
  }
  await addCustomComposerLine(page, { name: 'Recargo especial', quantity: '1', price: '1234567.89' });
  await addCustomComposerLine(page, { name: 'Visita de diagnóstico', quantity: '1', price: '500' });
};
