import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  hasE2eCredentials,
  hasE2eSystemCredentials,
  login,
  loginAs,
  loginAsSystemUser,
} from './helpers/auth';

/**
 * ZIG-I18-11 — a forgotten password without email: the admin (or an operator)
 * gives a temporary password, the person must replace it before anything else.
 *
 * Writes data, so it only runs against a CI/local-test database (CI=1).
 */
const writesAllowed = Boolean(process.env.CI);

test.describe('Login: ¿Olvidaste tu contraseña?', () => {
  test('says who to ask instead of leaving a dead end', async ({ page }) => {
    await page.goto('/login');
    const link = page.getByRole('button', { name: '¿Olvidaste tu contraseña?' });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await link.click();
    const dialog = page.getByRole('dialog', { name: '¿Olvidaste tu contraseña?' });
    await expect(dialog.getByText(/quien administra tu empresa/i)).toBeVisible();
    await expect(dialog.getByText(/correo/i)).toHaveCount(0);
  });
});

test.describe('Temporary password and forced change', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(() => {
    test.skip(!writesAllowed, 'Writes data: test database only (CI=1)');
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
  });

  const stamp = Date.now();
  const member = {
    name: `QA Recupera ${stamp}`,
    email: `qa-recupera-${stamp}@zigzag.test`,
    password: 'QaRecupera-123!',
    chosen: `Elegida-${stamp}!`,
  };
  let temporary = '';

  test('the admin gives a temporary password to a member of their company', async ({ page }) => {
    await login(page);
    await page.goto('/company/equipo');
    await page.getByRole('button', { name: 'Agregar usuario' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Agregar usuario' });
    await sheet.getByLabel('Nombre').fill(member.name);
    await sheet.getByLabel('Correo electrónico').fill(member.email);
    await sheet.getByRole('radio', { name: /^Operator/ }).check();
    await sheet.getByLabel('Contraseña inicial').fill(member.password);
    await sheet.getByLabel('Confirmar contraseña').fill(member.password);
    await sheet.getByRole('button', { name: 'Agregar usuario' }).click();
    await expect(sheet).toBeHidden();

    await page.getByRole('button', { name: `Acciones de ${member.name}` }).first().click();
    await page.getByRole('menuitem', { name: 'Dar contraseña temporal' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText(new RegExp(`Dar contraseña temporal a ${member.name}`))).toBeVisible();
    await dialog.getByRole('button', { name: 'Dar contraseña temporal' }).click();

    const shown = dialog.getByTestId('temporary-password');
    await expect(shown).toHaveText(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    temporary = (await shown.textContent()) ?? '';
    await expect(dialog.getByRole('link', { name: 'Enviar por WhatsApp' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Listo' }).click();
  });

  test('the old password stops working and the temporary one lands on the forced change', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.locator('#email').fill(member.email);
    await page.locator('#password').fill(member.password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByText(/Correo o contraseña incorrectos/)).toBeVisible();

    await loginAs(page, member.email, temporary, /\/cambiar-contrasena/);
    await expect(page.getByRole('heading', { name: 'Elige tu contraseña nueva' })).toBeVisible();

    // Nothing else is reachable until the password is changed.
    for (const path of ['/tickets', '/dashboard', '/clients']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/cambiar-contrasena/);
    }

    await page.getByLabel('Contraseña nueva', { exact: true }).fill(member.chosen);
    await page.getByLabel('Repite la contraseña nueva').fill(`${member.chosen}x`);
    await page.getByRole('button', { name: 'Guardar y entrar' }).click();
    await expect(page.getByTestId('forced-password-change').getByRole('alert')).toContainText(/no son iguales/i);

    await page.getByLabel('Repite la contraseña nueva').fill(member.chosen);
    await page.getByRole('button', { name: 'Guardar y entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    // The flag is cleared: the screen redirects home and the new password works.
    await page.goto('/cambiar-contrasena');
    await expect(page).toHaveURL(/\/dashboard/);
    await loginAs(page, member.email, member.chosen);
  });

  test('an operator can do the same for any user', async ({ page }) => {
    test.skip(!hasE2eSystemCredentials, 'Needs system credentials');
    await loginAsSystemUser(page);
    await page.goto('/users');
    await page.getByPlaceholder(/buscar/i).first().fill(member.email);
    await page.getByRole('row').filter({ hasText: member.email }).getByRole('button', { name: 'Abrir menú' }).click();
    await page.getByRole('menuitem', { name: 'Dar contraseña temporal' }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Dar contraseña temporal' }).click();
    const shown = dialog.getByTestId('temporary-password');
    await expect(shown).toHaveText(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    const next = (await shown.textContent()) ?? '';

    await loginAs(page, member.email, next, /\/cambiar-contrasena/);
    await expect(page.getByRole('heading', { name: 'Elige tu contraseña nueva' })).toBeVisible();
  });
});
