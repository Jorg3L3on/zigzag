import { test, expect, type Page } from '@playwright/test';
import {
  e2eSystemCredentialsSkipReason,
  ensureSystemCompany,
  hasE2eSystemCredentials,
  loginAsSystemUser,
} from './helpers/auth';
import { expectNoSeriousViolations } from './helpers/a11y';
import { waitForSettledLayout } from './helpers/layout';

/**
 * ZIG-I33-7 — the system admin lists (Roles, Usuarios, Permisos, Empresas) at 1280
 * on the list standard: title with the count, filters as pills, sort by header,
 * the ⋯ as the only row menu (Empresas keeps Seleccionar visible). Read-only: the
 * menus open and close, Editar opens the dialog or the edit page, nothing is saved.
 */
const openList = async (page: Page, path: string, rowTestId: string) => {
  await page.goto(path);
  await waitForSettledLayout(page);
  await expect(page.getByTestId(rowTestId).first()).toBeVisible({ timeout: 30_000 });
};

test.describe('Listas de administración en escritorio @1280px (ZIG-I33-7)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eSystemCredentials, e2eSystemCredentialsSkipReason);
    await loginAsSystemUser(page);
    await ensureSystemCompany(page);
  });

  test('Usuarios: title with the count, pills, header sort and Editar from the ⋯', async ({ page }) => {
    await openList(page, '/users', 'users-row');
    const main = page.locator('main');

    await expect(main.locator('h1')).toHaveCount(1);
    await expect(main.locator('h1')).toHaveText(/^Usuarios · \d+$/);
    // The «X de Y» chip is the phone's; on desktop the footer counts.
    await expect(page.getByTestId('list-footer')).toContainText(/de \d+ usuarios/);

    const verification = page.getByRole('combobox', { name: 'Filtrar por verificación del correo' });
    await expect(verification).toBeVisible();
    await expect(verification).toHaveText(/Todos los correos/);
    await expect(page.getByRole('combobox', { name: 'Filtrar por empresa' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Ordenar/ })).toHaveCount(0);

    await verification.click();
    await page.getByRole('option', { name: 'Verificados' }).click();
    await expect(verification).toHaveText(/Verificados/);
    const clear = page.getByRole('button', { name: 'Limpiar filtros de usuarios' });
    await expect(clear).toBeVisible();
    await clear.click();
    await expect(verification).toHaveText(/Todos los correos/);
    await expect(clear).toHaveCount(0);

    const nameHeader = page.getByRole('columnheader', { name: /Nombre/ });
    await expect(nameHeader).toHaveAttribute('aria-sort', 'none');
    await expect(page.getByRole('columnheader', { name: /Alta/ })).toHaveAttribute('aria-sort', 'descending');
    await nameHeader.getByRole('button').click();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    await nameHeader.getByRole('button').click();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');

    await expect(page.getByRole('columnheader', { name: 'Acciones' })).toBeAttached();
    const row = page.getByTestId('users-row').first();
    await row.getByRole('button', { name: /^Acciones de / }).click();
    const items = page.getByRole('menuitem');
    await expect(items.last()).toHaveText('Eliminar');
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Actualizar usuario')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('Empresas: title with the count, the status pill, header sort, Seleccionar visible and Eliminar in the ⋯', async ({ page }) => {
    await openList(page, '/companies', 'companies-row');
    const main = page.locator('main');

    await expect(main.locator('h1')).toHaveCount(1);
    await expect(main.locator('h1')).toHaveText(/^Empresas · \d+$/);
    await expect(main.getByRole('link', { name: 'Nueva empresa' })).toHaveCount(1);

    const status = page.getByRole('combobox', { name: 'Filtrar por estado' });
    await expect(status).toBeVisible();
    await expect(status).toHaveText(/Todos los estados/);
    await expect(page.getByRole('combobox', { name: /Ordenar/ })).toHaveCount(0);

    const nameHeader = page.getByRole('columnheader', { name: /Nombre/ });
    await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    await nameHeader.getByRole('button').click();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    await nameHeader.getByRole('button').click();

    const row = page.getByTestId('companies-row').first();
    await expect(row.getByRole('button', { name: /^Seleccionar contexto / })).toBeVisible();
    await expect(row.getByRole('button', { name: /^Editar / })).toHaveCount(0);
    await expect(row.getByRole('button', { name: /^Eliminar / })).toHaveCount(0);

    await row.getByRole('button', { name: /^Acciones de / }).click();
    const items = page.getByRole('menuitem');
    await expect(items).toHaveText(['Editar', 'Eliminar']);
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    await expect(page).toHaveURL(/\/companies\/\d+\/edit$/, { timeout: 30_000 });
  });

  for (const [path, rowTestId] of [
    ['/roles', 'roles-row'],
    ['/users', 'users-row'],
    ['/permissions', 'permissions-row'],
    ['/companies', 'companies-row'],
  ] as const) {
    test(`${path} has no serious axe violations`, async ({ page }) => {
      await openList(page, path, rowTestId);
      await expectNoSeriousViolations(page, path);
    });
  }
});
