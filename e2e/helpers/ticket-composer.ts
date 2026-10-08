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
      .getByRole('list', { name: 'Servicios del ticket' })
      .getByText(serviceName)
      .first(),
  ).toBeVisible();
  return serviceName;
};

export const saveComposer = async (page: Page) => {
  const save = page.getByRole('button', { name: 'Guardar ticket' }).first();
  await expect(save).toBeEnabled();
  await save.click();
  await page.waitForURL(/\/tickets\/\d+(\?|$)/, { timeout: 60_000 });
  const ticketId = page.url().match(/\/tickets\/(\d+)/)?.[1];
  expect(ticketId).toBeTruthy();
  return ticketId!;
};
