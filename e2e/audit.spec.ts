import { test, expect } from '@playwright/test';
import {
  e2eSystemCredentialsSkipReason,
  ensureSystemCompany,
  hasE2eSystemCredentials,
  loginAsSystemUser,
  loginAsViewer,
  e2eViewerCredentialsSkipReason,
  hasE2eViewerCredentials,
} from './helpers/auth';
import { expectNoSeriousViolations } from './helpers/a11y';
import { waitForSettledLayout } from './helpers/layout';

test.describe('Audit log access', () => {
  test('system admin can open audit page', async ({ page }) => {
    test.skip(!hasE2eSystemCredentials, e2eSystemCredentialsSkipReason);

    await loginAsSystemUser(page);
    await ensureSystemCompany(page);
    await page.goto('/audit');

    await expect(page.getByText('Auditoría', { exact: true }).first()).toBeVisible();
    await expect(
      page.getByLabel('Buscar eventos de auditoría'),
    ).toBeVisible();
  });

  test('non-system viewer is forbidden on audit page', async ({ page }) => {
    test.skip(!hasE2eViewerCredentials, e2eViewerCredentialsSkipReason);

    await loginAsViewer(page);
    await page.goto('/audit');
    await expect(page).toHaveURL(/\/forbidden/);
  });
});

/**
 * Auditoría on desktop (ZIG-I33-8): the list standard at 1280 px. Read-only: it
 * only filters, expands rows and opens the phone sheet.
 */
test.describe('Auditoría en escritorio (ZIG-I33-8)', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eSystemCredentials, e2eSystemCredentialsSkipReason);
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsSystemUser(page);
    await ensureSystemCompany(page);
  });

  test('the row opens the event, with no Detalle column', async ({ page }) => {
    await page.goto('/audit');
    await waitForSettledLayout(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Auditoría' })).toBeVisible();
    await expect(page.getByText(/eventos? cargados?\./)).toBeVisible({ timeout: 30_000 });

    const table = page.getByRole('table', { name: 'Eventos de auditoría' });
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Detalle' })).toHaveCount(0);
    await expect(table.getByRole('button', { name: 'Ver', exact: true })).toHaveCount(0);

    // Click the Cuándo cell: the summary may hold a link to the resource.
    const row = table.getByTestId('audit-row').first();
    await row.getByRole('cell').nth(1).click();
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    const detail = table.getByTestId('audit-row-detail');
    await expect(detail).toBeVisible();
    await expect(detail.getByRole('heading', { name: 'Metadatos de solicitud' })).toBeVisible();

    // And by keyboard.
    await row.focus();
    await page.keyboard.press('Enter');
    await expect(row).toHaveAttribute('aria-expanded', 'false');
    await expect(detail).toHaveCount(0);

    await expect(page.getByTestId('list-footer')).toContainText(/eventos? cargados?/);
    await expectNoSeriousViolations(page, 'audit 1280');
  });

  test('the Hoy preset gets the selected-filter tint and goes to the URL', async ({ page }) => {
    await page.goto('/audit');
    await waitForSettledLayout(page);

    const presets = page.getByRole('group', { name: 'Presets de investigación' });
    const today = presets.getByRole('button', { name: 'Hoy' });
    await expect(today).toHaveAttribute('aria-pressed', 'false');
    await expect(today).not.toHaveClass(/bg-primary\/10/);

    await today.click();
    await expect(today).toHaveAttribute('aria-pressed', 'true');
    // FILTER_SELECTED_CLASS (eb0ff213): a tint, never the solid blue of the page action.
    await expect(today).toHaveClass(/bg-primary\/10/);
    await expect(today).toHaveClass(/border-primary\/40/);
    await expect(page).toHaveURL(/[?&]from=\d{4}-\d{2}-\d{2}/);

    // Limpiar is the neutral ghost and clears the preset.
    const clear = page.getByRole('button', { name: 'Limpiar todos los filtros' });
    await expect(clear).not.toHaveClass(/destructive/);
    await clear.click();
    await expect(today).toHaveAttribute('aria-pressed', 'false');
  });

  test('the phone sheet has no red Limpiar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/audit?result=denied');
    await waitForSettledLayout(page);

    await page.getByRole('button', { name: /Abrir filtros/ }).click();
    await expect(page.getByRole('heading', { name: 'Filtros' })).toBeVisible();

    const clear = page.getByRole('button', { name: 'Limpiar todos los filtros activos' });
    await expect(clear).toBeVisible();
    // The shared sheet's neutral ghost (f6ffafda); the old copy was text-destructive.
    await expect(clear).not.toHaveClass(/destructive/);
    await expect(clear).toHaveClass(/text-muted-foreground/);
  });
});
