import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { hasE2eSystemCredentials, loginAsSystemUser } from './helpers/auth';
import { waitForSettledLayout } from './helpers/layout';

/**
 * Acceso writes (ZIG-I38-6): temporary password, role change and deactivation
 * from the row menu. They change real people, so they only run against a
 * disposable database:
 *   OPERATOR_CONSOLE_WRITES=1 OPERATOR_ACCESS_COMPANY_ID=<id> OPERATOR_ACCESS_PERSON=<email> DATABASE_URL=<scratch db>
 */
const enabled =
  process.env.OPERATOR_CONSOLE_WRITES === '1' &&
  Boolean(process.env.OPERATOR_ACCESS_COMPANY_ID) &&
  Boolean(process.env.OPERATOR_ACCESS_PERSON) &&
  Boolean(process.env.DATABASE_URL) &&
  !process.env.DATABASE_URL?.includes('neon.tech');

const person = async (email: string) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ role: string | null; deleted: boolean; must_change: boolean }>(
      `select r.name as role, u.deleted_at is not null as deleted, u.must_change_password as must_change
         from "User" u left join "Role" r on r.id = u.role_id where u.email = $1`,
      [email],
    );
    return rows[0];
  } finally {
    await client.end();
  }
};

test.describe('Acceso: menú por fila contra base de pruebas (ZIG-I38-6)', () => {
  test.skip(!enabled || !hasE2eSystemCredentials, 'Writes only against a disposable DB (OPERATOR_CONSOLE_WRITES=1)');
  test.setTimeout(240_000);

  test('temporary password, role change and deactivation', async ({ page }) => {
    const id = process.env.OPERATOR_ACCESS_COMPANY_ID!;
    const email = process.env.OPERATOR_ACCESS_PERSON!;
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsSystemUser(page);
    await page.goto(`/operator-console/${id}/acceso`);
    await waitForSettledLayout(page);

    const people = page.getByRole('table', { name: 'Personas de la empresa' });
    const row = people.getByTestId('operator-access-person').filter({ hasText: email });
    await expect(row).toBeVisible({ timeout: 30_000 });
    const name = (await row.locator('p').first().textContent())?.trim() ?? '';

    // Temporary password.
    await row.getByRole('button', { name: `Acciones de ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Dar contraseña temporal' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: /Dar contraseña temporal/ }).click();
    await expect(page.getByTestId('temporary-password')).not.toBeEmpty({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Listo' }).click();
    expect((await person(email)).must_change).toBe(true);

    // Role change.
    await row.getByRole('button', { name: `Acciones de ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Cambiar rol' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cambiar rol' });
    await dialog.getByLabel('Rol').click();
    await page.getByRole('option', { name: 'Viewer' }).click();
    await dialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });
    await expect(row).toContainText('Viewer', { timeout: 30_000 });
    expect((await person(email)).role).toBe('Viewer');

    // Deactivate.
    await row.getByRole('button', { name: `Acciones de ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Desactivar' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Desactivar' }).click();
    await expect(row).toContainText('Desactivada', { timeout: 30_000 });
    expect((await person(email)).deleted).toBe(true);
  });
});
