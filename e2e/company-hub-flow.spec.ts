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
    password: 'QaTecnico-123!',
  };

  test('adds a team member with the Operator role', async ({ page }) => {
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
    const row = page.getByTestId('team-member-row').filter({ hasText: member.email });
    await expect(row).toBeVisible();
    await expect(row.getByText('Operator')).toBeVisible();
  });

  test('takes Servicios / Editar away from Operator', async ({ page }) => {
    await login(page);
    await page.goto('/company/roles');
    await page
      .getByTestId('role-list-item')
      .filter({ hasText: /^Operator/ })
      .first()
      .click();

    const editServices = page.getByRole('checkbox', { name: 'Editar Servicios' });
    await expect(editServices).toBeChecked();
    await editServices.uncheck();
    await expect(page.getByRole('checkbox', { name: 'Ver Servicios' })).toBeChecked();
    await page.getByRole('button', { name: 'Guardar rol' }).click();

    // Saved (as the company's own copy when Operator was a shared role).
    await expect(page.getByText(/Rol guardado/)).toBeVisible();
    await page.reload();
    await page
      .getByTestId('role-list-item')
      .filter({ hasText: /^Operator/ })
      .first()
      .click();
    await expect(page.getByRole('checkbox', { name: 'Editar Servicios' })).not.toBeChecked();
  });

  test('the member sees services read-only', async ({ page }) => {
    await loginAs(page, member.email, member.password);
    await page.goto('/services');
    await expect(page).toHaveURL(/\/services/);
    await expect(page.getByText('Catálogo de servicios y precios.').first()).toBeVisible();
    // Neither the header link nor the empty-state button to create services.
    await expect(page.getByRole('link', { name: /Nuevo servicio/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Nuevo servicio/i })).toHaveCount(0);
  });
});
