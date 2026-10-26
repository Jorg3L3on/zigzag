import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  hasE2eCredentials,
  login,
  loginAs,
} from './helpers/auth';

/**
 * ZIG-I3-7 — full Mi empresa flow: add a user as Operator, take Servicios /
 * Editar away from Operator, and check that user can no longer edit services.
 * ZIG-I32: at 1280 the person is added from the Agregar persona panel with a
 * temporary password, replaced at the first login.
 *
 * Writes data, so it only runs in CI (its own Postgres). Locally DATABASE_URL
 * is production; never run this there (pinned Plania decision).
 */
const writesAllowed = Boolean(process.env.CI);

test.describe('Mi empresa: team and role flow', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    test.skip(!writesAllowed, 'Writes data: CI database only');
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  const stamp = Date.now();
  const member = {
    name: `QA Técnico ${stamp}`,
    email: `qa-tecnico-${stamp}@zigzag.test`,
    password: `QaTecnico-${stamp}!`,
  };
  let temporary = '';

  test('adds a team member with the Operator role and a temporary password', async ({ page }) => {
    await login(page);
    await page.goto('/company/equipo');
    await page.getByRole('button', { name: 'Agregar persona' }).click();

    const panel = page.getByTestId('team-member-panel');
    await panel.getByLabel('Nombre').fill(member.name);
    await panel.getByLabel('Correo electrónico').fill(member.email);
    await panel.getByRole('radio', { name: /^Operador/ }).check();
    await expect(panel.getByLabel('Contraseña inicial')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Agregar', exact: true }).click();

    const shown = panel.getByTestId('temporary-password');
    await expect(shown).toHaveText(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    temporary = (await shown.textContent()) ?? '';
    await expect(panel.getByRole('button', { name: 'Copiar' })).toBeVisible();
    await expect(panel.getByRole('link', { name: /WhatsApp/ })).toBeVisible();
    await panel.getByRole('button', { name: 'Listo' }).click();
    await expect(panel).toBeHidden();

    const row = page.getByTestId('team-member-row').filter({ hasText: member.email });
    await expect(row).toBeVisible();
    await expect(row.getByText('Operador')).toBeVisible();
    await expect(row.getByTestId('team-member-access')).toHaveText('Debe cambiar contraseña');
  });

  test('Restablecer contraseña on hover shows the password once; self and last admin stay blocked', async ({
    page,
  }) => {
    await login(page);
    await page.goto('/company/equipo');
    const row = page.getByTestId('team-member-row').filter({ hasText: member.email });
    await row.hover();
    await row.getByRole('button', { name: `Restablecer contraseña de ${member.name}` }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Dar contraseña temporal' }).click();
    const shown = dialog.getByTestId('temporary-password');
    await expect(shown).toHaveText(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    temporary = (await shown.textContent()) ?? '';
    await dialog.getByRole('button', { name: 'Listo' }).click();
    await expect(row.getByTestId('team-member-access')).toHaveText('Debe cambiar contraseña');

    // Your own row: no reset on hover and Desactivar disabled (team-guards unchanged).
    const self = page.getByTestId('team-member-row').filter({ hasText: '(tú)' });
    await self.hover();
    await expect(self.getByRole('button', { name: /^Restablecer contraseña/ })).toHaveCount(0);
    await self.getByRole('button', { name: /^Acciones de/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Desactivar (eres tú)' })).toBeDisabled();
    await page.keyboard.press('Escape');
  });

  test('takes Servicios / Editar away from Operator', async ({ page }) => {
    await login(page);
    await page.goto('/company/roles');
    await page
      .getByTestId('role-list-item')
      .filter({ hasText: /^(Operador|Operator)/ })
      .first()
      .click();

    const editServices = page.getByRole('switch', { name: 'Editar Servicios' });
    await expect(editServices).toBeChecked();
    await editServices.click();
    await expect(editServices).not.toBeChecked();
    await expect(page.getByRole('switch', { name: 'Ver Servicios' })).toBeChecked();
    await page.getByRole('button', { name: 'Guardar rol' }).click();

    // Saved (as the company's own copy when Operator was a shared role).
    await expect(page.getByText(/Rol guardado/)).toBeVisible();
    await page.reload();
    await page
      .getByTestId('role-list-item')
      .filter({ hasText: /^(Operador|Operator)/ })
      .first()
      .click();
    await expect(page.getByRole('switch', { name: 'Editar Servicios' })).not.toBeChecked();
  });

  test('the member sees services read-only', async ({ page }) => {
    await loginAs(page, member.email, temporary, /\/cambiar-contrasena/);
    await page.getByLabel('Contraseña nueva', { exact: true }).fill(member.password);
    await page.getByLabel('Repite la contraseña nueva').fill(member.password);
    await page.getByRole('button', { name: 'Guardar y entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await page.goto('/services');
    await expect(page).toHaveURL(/\/services/);
    await expect(page.getByText('Administra el catálogo de servicios disponibles').first()).toBeVisible();
    // Neither the header link nor the empty-state button to create services.
    await expect(page.getByRole('link', { name: /Nuevo servicio/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Nuevo servicio/i })).toHaveCount(0);
  });

  test('Activos hides a deactivated member and Todos shows it as Desactivado', async ({ page }) => {
    await login(page);
    await page.goto('/company/equipo');
    const desktop = page.getByTestId('team-desktop');
    const row = desktop.getByTestId('team-member-row').filter({ hasText: member.email });
    await row.getByRole('button', { name: `Acciones de ${member.name}` }).click();
    await page.getByRole('menuitem', { name: 'Desactivar' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: /Desactivar/ }).click();
    await expect(row).toHaveCount(0);

    await desktop.getByRole('button', { name: 'Todos' }).click();
    await expect(row.getByTestId('team-member-access')).toHaveText('Desactivado');
    await expect(row.getByRole('button', { name: /Acciones de/ })).toHaveCount(0);
  });
});

