import { test, expect } from '@playwright/test';
import {
  e2eSystemCredentialsSkipReason,
  hasE2eSystemCredentials,
  loginAsSystemUser,
} from './helpers/auth';
import { expectNoSeriousViolations } from './helpers/a11y';
import { waitForSettledLayout } from './helpers/layout';

/**
 * Consola operadora on desktop (ZIG-I33-8) with the system operator login. Read-only:
 * selecting a company only changes the browser's context (localStorage).
 */
test.describe('Consola operadora en escritorio (ZIG-I33-8)', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eSystemCredentials, e2eSystemCredentialsSkipReason);
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsSystemUser(page);
  });

  test('fleet table, Seleccionar visible and Nueva empresa to /companies/new', async ({ page }) => {
    await page.goto('/operator-console');
    await waitForSettledLayout(page);

    await expect(
      page.getByRole('heading', { level: 2, name: /^Flota de empresas · \d+$/ }),
    ).toBeVisible({ timeout: 30_000 });
    const fleet = page.getByRole('table', { name: 'Flota de empresas' });
    await expect(fleet).toBeVisible();
    // Header sort only, aria-sort on the th.
    await expect(fleet.getByRole('columnheader', { name: /Empresa/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );

    // Nothing appears on hover: Seleccionar is there before any pointer moves.
    const firstRow = fleet.getByTestId('operator-fleet-row').first();
    await expect(firstRow.getByRole('button', { name: /^Seleccionar contexto / })).toBeVisible();

    await expectNoSeriousViolations(page, 'operator console 1280');

    const newCompany = page.getByRole('link', { name: 'Nueva empresa' });
    await expect(newCompany).toHaveAttribute('href', '/companies/new');
    await newCompany.click();
    await expect(page).toHaveURL(/\/companies\/new$/);
  });

  test('the company detail uses the list view tabs', async ({ page }) => {
    await page.goto('/operator-console');
    await waitForSettledLayout(page);

    const fleet = page.getByRole('table', { name: 'Flota de empresas' });
    await expect(fleet).toBeVisible({ timeout: 30_000 });
    await fleet
      .getByTestId('operator-fleet-row')
      .first()
      .getByRole('button', { name: /^Seleccionar contexto / })
      .click();

    const tabs = page.getByRole('navigation', { name: 'Secciones de la empresa seleccionada' });
    await expect(tabs).toBeVisible({ timeout: 30_000 });
    // ListViewTabs: buttons with aria-pressed and the blue underline, no solid blue pill.
    await expect(page.getByRole('tablist')).toHaveCount(0);
    const resumen = tabs.getByRole('button', { name: 'Resumen' });
    await expect(resumen).toHaveAttribute('aria-pressed', 'true');
    await expect(resumen).toHaveClass(/border-primary/);
    await expect(resumen).not.toHaveClass(/bg-primary/);

    await tabs.getByRole('button', { name: 'Actividad' }).click();
    await expect(tabs.getByRole('button', { name: 'Actividad' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(
      page
        .getByRole('table', { name: 'Actividad reciente' })
        .or(page.getByText('Sin actividad', { exact: true })),
    ).toBeVisible({ timeout: 30_000 });

    await expectNoSeriousViolations(page, 'operator console activity 1280');
  });
});
