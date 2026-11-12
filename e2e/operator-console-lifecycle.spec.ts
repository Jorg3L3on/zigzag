import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { hasE2eSystemCredentials, loginAsSystemUser } from './helpers/auth';
import { waitForSettledLayout } from './helpers/layout';

/**
 * Ciclo de vida writes (ZIG-I38-7). They suspend, restore and archive a real
 * company, so they only run against a disposable database:
 *   OPERATOR_CONSOLE_WRITES=1 OPERATOR_WRITE_COMPANY_ID=<id> DATABASE_URL=<scratch db>
 * Never point them at production data.
 */
const enabled =
  process.env.OPERATOR_CONSOLE_WRITES === '1' &&
  Boolean(process.env.OPERATOR_WRITE_COMPANY_ID) &&
  Boolean(process.env.DATABASE_URL) &&
  !process.env.DATABASE_URL?.includes('neon.tech');

const auditReasons = async (companyId: string) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query<{ action: string; after_status: string | null; reason: string | null }>(
      `select action, payload->'after'->>'status' as after_status, payload->>'reason' as reason
         from "AuditEvent" where target_company_id = $1 and resource_type = 'company'
         order by id desc limit 5`,
      [Number(companyId)],
    );
    return rows;
  } finally {
    await client.end();
  }
};

test.describe('Ciclo de vida: suspender, restaurar y archivar con motivo (ZIG-I38-7)', () => {
  test.skip(!enabled || !hasE2eSystemCredentials, 'Writes only against a disposable DB (OPERATOR_CONSOLE_WRITES=1)');
  test.setTimeout(240_000);

  test('the reason lands in the audit and the history; archive needs the exact name', async ({ page }) => {
    const id = process.env.OPERATOR_WRITE_COMPANY_ID!;
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsSystemUser(page);
    await page.goto(`/operator-console/${id}/ciclo-de-vida`);
    await waitForSettledLayout(page);

    // Suspend: the confirm stays disabled until there is a reason.
    await page.getByRole('button', { name: 'Suspender', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    const confirm = dialog.getByRole('button', { name: 'Suspender empresa' });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel('Motivo').fill('Prueba e2e: falta de pago');
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(dialog).toBeHidden({ timeout: 30_000 });

    // Header and history show the new state without a reload (E4).
    await expect(page.locator('header').getByText('Suspendida', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('table', { name: 'Historial de estado' })).toContainText('Prueba e2e: falta de pago', {
      timeout: 30_000,
    });
    expect((await auditReasons(id))[0]).toMatchObject({ after_status: 'SUSPENDED', reason: 'Prueba e2e: falta de pago' });

    // Restore from the header.
    await page.getByRole('button', { name: 'Restaurar acceso' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Restaurar acceso' }).click();
    await expect(page.locator('header').getByText('Activa', { exact: true })).toBeVisible({ timeout: 30_000 });

    // Archive: needs the reason and the exact company name.
    const name = (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? '';
    await page.getByRole('button', { name: 'Archivar', exact: true }).click();
    const archive = page.getByRole('alertdialog');
    const archiveButton = archive.getByRole('button', { name: 'Archivar definitivamente' });
    await archive.getByLabel('Motivo').fill('Prueba e2e: cierre');
    await archive.getByLabel(/para confirmar/).fill(`${name} x`);
    await expect(archiveButton).toBeDisabled();
    await archive.getByLabel(/para confirmar/).fill(name);
    await expect(archiveButton).toBeEnabled();
    await archiveButton.click();
    await expect(page.getByRole('region', { name: 'Empresa archivada' })).toContainText('Motivo: Prueba e2e: cierre', {
      timeout: 30_000,
    });
    expect((await auditReasons(id))[0]).toMatchObject({ after_status: 'ARCHIVED', reason: 'Prueba e2e: cierre' });

    // The fleet shows it archived when we go back (no reload of the company page needed).
    await page.goto('/operator-console');
    await waitForSettledLayout(page);
    const row = page.getByTestId('operator-fleet-row').filter({ hasText: name });
    await expect(row.getByText('Archivada', { exact: true })).toBeVisible({ timeout: 30_000 });
  });
});
