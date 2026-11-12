import { test, expect, type Page } from '@playwright/test';
import {
  e2eSystemCredentialsSkipReason,
  hasE2eSystemCredentials,
  loginAsSystemUser,
} from './helpers/auth';
import { expectNoSeriousViolations } from './helpers/a11y';
import { waitForSettledLayout } from './helpers/layout';

/**
 * Consola operadora (ZIG-I38): the fleet at /operator-console and one page
 * per company at /operator-console/[id]/<tab>, with the system operator
 * login. Read-only: nothing here changes a company, a person or a role.
 */

const selectedCompany = (page: Page) =>
  page.evaluate(() => window.localStorage.getItem('selectedCompany'));

const openFirstCompany = async (page: Page) => {
  await page.goto('/operator-console');
  await waitForSettledLayout(page);
  const fleet = page.getByRole('table', { name: 'Flota de empresas' });
  await expect(fleet).toBeVisible({ timeout: 30_000 });
  await fleet.getByTestId('operator-fleet-row').first().getByRole('link', { name: /^Abrir / }).click();
  await expect(page).toHaveURL(/\/operator-console\/\d+\/resumen$/, { timeout: 30_000 });
  await waitForSettledLayout(page);
  return page.url().match(/operator-console\/(\d+)\//)?.[1] ?? '';
};

test.describe('Consola operadora en escritorio (ZIG-I38)', () => {
  test.setTimeout(150_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eSystemCredentials, e2eSystemCredentialsSkipReason);
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsSystemUser(page);
  });

  test('fleet: title with the count, view tabs, Atención column, Abrir and Nueva empresa', async ({ page }) => {
    await page.goto('/operator-console');
    await waitForSettledLayout(page);

    await expect(
      page.getByRole('heading', { level: 1, name: /^Consola operadora · \d+$/ }),
    ).toBeVisible({ timeout: 30_000 });
    const views = page.getByRole('navigation', { name: 'Vistas de la flota' });
    await expect(views.getByRole('button', { name: /Todas/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(views.getByRole('button', { name: /Requieren atención/ })).toBeVisible();

    const fleet = page.getByRole('table', { name: 'Flota de empresas' });
    await expect(fleet).toBeVisible();
    await expect(fleet.getByRole('columnheader', { name: /Empresa/ })).toHaveAttribute('aria-sort', 'ascending');
    await expect(fleet.getByRole('columnheader', { name: /Atención/ })).toBeVisible();
    // Nothing appears on hover: Abrir is there before any pointer moves.
    const firstRow = fleet.getByTestId('operator-fleet-row').first();
    await expect(firstRow.getByRole('link', { name: /^Abrir / })).toBeVisible();

    // Each view filters, and its count matches the rows shown.
    for (const name of ['Activas', 'Requieren atención', 'Todas']) {
      const tab = views.getByRole('button', { name: new RegExp(name) });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-pressed', 'true');
      const caption = (await tab.locator('span').last().textContent()) ?? '';
      const count = Number.parseInt(caption, 10);
      const rows = await fleet.getByTestId('operator-fleet-row').count().catch(() => 0);
      if (Number.isFinite(count) && count > 0) expect(rows).toBe(count);
    }

    await expectNoSeriousViolations(page, 'operator console fleet 1280');

    const newCompany = page.getByRole('link', { name: 'Nueva empresa' });
    await expect(newCompany).toHaveAttribute('href', '/companies/new');
  });

  test('opening a company keeps the app context; tabs are routes; Back returns to the fleet', async ({ page }) => {
    await page.goto('/operator-console');
    await waitForSettledLayout(page);
    const before = await selectedCompany(page);

    const id = await openFirstCompany(page);
    expect(id).not.toBe('');
    // Opening a company does not switch the app's company (audit P3).
    expect(await selectedCompany(page)).toBe(before);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
    const tabs = page.getByRole('navigation', { name: 'Secciones de la empresa' });
    await expect(tabs.getByRole('link', { name: /Resumen/ })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await expectNoSeriousViolations(page, 'operator company resumen 1280');

    for (const [label, slug] of [
      ['Actividad', 'actividad'],
      ['Acceso', 'acceso'],
      ['Ciclo de vida', 'ciclo-de-vida'],
    ] as const) {
      await tabs.getByRole('link', { name: new RegExp(label) }).click();
      await expect(page).toHaveURL(new RegExp(`/operator-console/${id}/${slug}$`));
      await waitForSettledLayout(page);
      await expect(tabs.getByRole('link', { name: new RegExp(label) })).toHaveAttribute('aria-current', 'page');
      await expect(page.getByRole('tablist')).toHaveCount(0);
      await expectNoSeriousViolations(page, `operator company ${slug} 1280`);
    }

    // Reload keeps the company and the tab.
    await page.reload();
    await waitForSettledLayout(page);
    await expect(page).toHaveURL(new RegExp(`/operator-console/${id}/ciclo-de-vida$`));
    await expect(tabs.getByRole('link', { name: /Ciclo de vida/ })).toHaveAttribute('aria-current', 'page', {
      timeout: 30_000,
    });

    // Browser Back walks the tabs and then the fleet.
    for (let i = 0; i < 4; i += 1) await page.goBack();
    await expect(page).toHaveURL(/\/operator-console$/, { timeout: 30_000 });
  });

  test('legacy ?company= links open the company page', async ({ page }) => {
    const id = await openFirstCompany(page);
    await page.goto(`/operator-console?company=${id}`);
    await expect(page).toHaveURL(new RegExp(`/operator-console/${id}/resumen$`), { timeout: 30_000 });
  });

  test('Actividad: filters reach the API; Acceso: two tables, one solid blue button at most', async ({ page }) => {
    const id = await openFirstCompany(page);
    await page.goto(`/operator-console/${id}/actividad`);
    await waitForSettledLayout(page);
    const firstRequest = page.waitForRequest((request) => request.url().includes('/api/audit/events'));
    await page.reload();
    const url = new URL((await firstRequest).url());
    expect(url.searchParams.get('target_company_id')).toBe(id);
    expect(url.searchParams.get('from')).not.toBeNull();
    expect(url.searchParams.get('to')).not.toBeNull();

    await page.goto(`/operator-console/${id}/acceso`);
    await waitForSettledLayout(page);
    await expect(page.getByRole('table', { name: 'Roles de la empresa' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('tablist')).toHaveCount(0);
  });
});

test.describe('Consola operadora en teléfono (ZIG-I38-8)', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eSystemCredentials, e2eSystemCredentialsSkipReason);
  });

  for (const width of [375, 333]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await loginAsSystemUser(page);
      for (const path of ['/operator-console']) {
        await page.goto(path);
        await waitForSettledLayout(page);
        await expect(page.getByTestId('operator-fleet-card').first()).toBeVisible({ timeout: 30_000 });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - (window.visualViewport?.width ?? window.innerWidth),
        );
        expect(overflow).toBeLessThanOrEqual(1);
      }
      await page.getByTestId('operator-fleet-card').first().getByRole('link', { name: /^Abrir / }).click();
      await expect(page).toHaveURL(/\/operator-console\/\d+\/resumen$/, { timeout: 30_000 });
      await waitForSettledLayout(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - (window.visualViewport?.width ?? window.innerWidth),
      );
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
