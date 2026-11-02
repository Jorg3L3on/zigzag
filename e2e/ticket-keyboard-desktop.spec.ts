import { test, expect } from '@playwright/test';
import { e2eCredentialsSkipReason, ensureTenantCompany, hasE2eCredentials, login } from './helpers/auth';
import { openComposer } from './helpers/ticket-composer';

/**
 * ZIG-I36-28 (M-15): a ticket created with the keyboard alone. Arrow keys move in the
 * Cliente and Servicio lists with a visible ring, focus stays inside the open sheet,
 * Escape gives it back to the button that opened it, and a skip link leads to the
 * content. Saves one ticket: scratch DB or CI.
 */
test.describe('Nuevo ticket by keyboard @1280px', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('skip link, arrows, trapped focus and focus back to the trigger', async ({ page }) => {
    await openComposer(page);

    // The first Tab stop is the skip link; Enter puts focus on the content.
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Saltar al contenido' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#contenido')).toBeFocused();

    // Cliente: open with the keyboard, move with the arrows, pick with Enter.
    const clientTrigger = page.getByRole('combobox', { name: 'Cliente' });
    await clientTrigger.focus();
    await page.keyboard.press('Enter');
    const search = page.getByRole('combobox', { name: /Buscar por nombre o teléfono/ });
    await expect(search).toBeFocused();
    const clientList = page.getByRole('listbox', { name: 'Cliente' });
    await expect(clientList.getByRole('option').first()).toBeVisible({ timeout: 15_000 });
    await expect(clientList).not.toHaveAttribute('aria-busy', 'true');
    await page.keyboard.press('ArrowDown');
    const activeClient = clientList.getByRole('option').nth(1);
    await expect(activeClient).toHaveAttribute('data-active', 'true');
    await expect(search).toHaveAttribute('aria-activedescendant', (await activeClient.getAttribute('id')) ?? '');
    await expect(activeClient.getByRole('button')).toHaveCSS('box-shadow', /rgb/);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('composer-party-card')).toBeVisible();

    // Agregar servicio: the sheet keeps focus inside, however many times Tab is pressed.
    const addService = page.getByRole('button', { name: 'Agregar servicio' });
    await addService.focus();
    await page.keyboard.press('Enter');
    const sheet = page.getByRole('dialog', { name: 'Agregar servicio' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'Agregar servicio' })).toHaveCount(1);

    await sheet.getByRole('combobox', { name: 'Servicio' }).focus();
    await page.keyboard.press('Enter');
    const serviceList = page.getByRole('listbox', { name: 'Servicio' });
    await expect(serviceList.getByRole('option').first()).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await expect(serviceList.getByRole('option').nth(1)).toHaveAttribute('data-active', 'true');
    await page.keyboard.press('Enter');
    await expect(serviceList).toBeHidden();

    for (let step = 0; step < 40; step += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(
        () => document.activeElement?.closest('[role="dialog"]') != null,
      );
      expect(inside, `Tab ${step + 1} left the sheet`).toBe(true);
    }

    // Escape closes the sheet and focus goes back to Agregar servicio.
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(addService).toBeFocused();

    // Again, and finish with the keyboard only: the line, then Guardar ticket.
    await page.keyboard.press('Enter');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('combobox', { name: 'Servicio' }).focus();
    await page.keyboard.press('Enter');
    await expect(serviceList.getByRole('option').first()).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Enter');
    const submit = sheet.getByRole('button', { name: 'Agregar al ticket' });
    for (let step = 0; step < 40 && !(await submit.evaluate((node) => node === document.activeElement)); step += 1) {
      await page.keyboard.press('Tab');
    }
    await expect(submit).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId('composer-line-row')).toHaveCount(1);

    const save = page.getByRole('button', { name: /^Guardar ticket$/ }).last();
    await save.focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/tickets\/\d+|\/tickets(\?|$)/, { timeout: 30_000 });
  });
});
