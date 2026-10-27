import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import { expectNoSeriousViolations } from './helpers/a11y';
import { waitForSettledLayout } from './helpers/layout';

/**
 * Clientes and Servicios on the list standard (ZIG-I33-4): one tree from lg, the
 * shared table with its sticky header, header sort with aria-sort on the th and the
 * shared footer (25 a page). Read only: it opens pages, scrolls, sorts and pages.
 */
const ROUTES = [
  {
    path: '/clients',
    table: 'Clientes',
    row: 'clients-row',
    noun: 'clientes',
    // The phone card's header line; the desktop title says it with a period.
    cardDescription: 'Catálogo de clientes y datos de contacto',
  },
  {
    path: '/services',
    table: 'Servicios',
    row: 'services-row',
    noun: 'servicios',
    cardDescription: 'Administra el catálogo de servicios disponibles',
  },
] as const;

const openList = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(page.getByTestId('page-header').first()).toBeVisible({ timeout: 30_000 });
  await waitForSettledLayout(page);
  // The first load ends in the table, the phone cards or an empty state.
  await expect(page.locator('main [role="status"][aria-busy="true"]')).toHaveCount(0, {
    timeout: 30_000,
  });
};

test.describe('Clientes y Servicios en escritorio (ZIG-I33-4)', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('at 1024 only the desktop tree, at 900 only the phone list', async ({ page }) => {
    for (const route of ROUTES) {
      await page.setViewportSize({ width: 1024, height: 800 });
      await openList(page, route.path);
      await expect(
        page.getByRole('heading', { level: 1, name: new RegExp(`^${route.table} · \\d+$`) }),
        `${route.path} @1024: desktop title`,
      ).toBeVisible();
      await expect(page.getByText(route.cardDescription, { exact: true })).toBeHidden();
      await expect(page.locator('main article'), `${route.path} @1024: no phone cards`).toHaveCount(0);
      if ((await page.getByTestId(route.row).count()) > 0) {
        await expect(page.getByRole('table', { name: route.table })).toBeVisible();
        await expect(page.locator('main table')).toHaveCount(1);
      }

      await page.setViewportSize({ width: 900, height: 800 });
      await openList(page, route.path);
      await expect(page.locator('main table'), `${route.path} @900: no table`).toHaveCount(0);
      await expect(page.getByTestId('list-footer')).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1, name: new RegExp(`^${route.table} · `) })).toHaveCount(0);
      // One card header, the phone's: title and its line, shown once.
      await expect(page.getByText(route.cardDescription, { exact: true })).toHaveCount(1);
      await expect(page.getByText(route.cardDescription, { exact: true })).toBeVisible();
      const cards = page.locator('main article');
      if ((await cards.count()) > 0) await expect(cards.first()).toBeVisible();
    }
  });

  test('clients at 1280: sticky header, 25 a page with the shared pager, sort by Nombre', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openList(page, '/clients');
    const table = page.getByRole('table', { name: 'Clientes' });
    await expect(table).toBeVisible({ timeout: 30_000 });
    const footer = page.getByTestId('list-footer');
    const total = Number(/de (\d+) clientes/.exec((await footer.textContent()) ?? '')?.[1] ?? 0);
    test.skip(total <= 25, `the e2e tenant has ${total} clients; paging needs more than 25`);

    await expect(footer).toContainText(`1–25 de ${total} clientes`);
    await expect(page.getByTestId('clients-row')).toHaveCount(25);

    // Sticky header: after scrolling past it, the thead sits under the 64 px app bar.
    const head = table.locator('thead');
    await page.mouse.wheel(0, 700);
    await expect
      .poll(async () => Math.abs(((await head.boundingBox())?.y ?? 0) - 64) <= 1, { timeout: 5_000 })
      .toBe(true);
    const firstRowTop = (await page.getByTestId('clients-row').first().boundingBox())?.y ?? 0;
    expect(firstRowTop, 'the rows scrolled under the header').toBeLessThan(64);

    // Numbered pager: page 2 starts at 26.
    await page.getByRole('navigation', { name: 'Paginación' }).getByRole('button', { name: 'Página 2' }).click();
    await expect(footer).toContainText(new RegExp(`^26–\\d+ de ${total} clientes`));
    await expect(
      page.getByRole('navigation', { name: 'Paginación' }).getByRole('button', { name: 'Página 2' }),
    ).toHaveAttribute('aria-current', 'page');
    await page.getByRole('button', { name: 'Página anterior' }).click();
    await expect(footer).toContainText(`1–25 de ${total} clientes`);

    // Sort by Nombre: aria-sort lives on the th, not on the button.
    const nameHeader = table.locator('thead th').filter({ hasText: 'Nombre' });
    await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    const nameButton = nameHeader.getByRole('button', { name: /Nombre/ });
    await expect(nameButton).not.toHaveAttribute('aria-sort');
    await nameButton.click();
    await expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(table.locator('thead th').filter({ hasText: 'Teléfono' })).toHaveAttribute('aria-sort', 'none');
    // No sort select on desktop.
    await expect(
      page.getByRole('combobox', { name: 'Ordenar lista de clientes' }).filter({ visible: true }),
    ).toHaveCount(0);
  });

  test('services at 1280: shared table and footer with the noun', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openList(page, '/services');
    const rows = page.getByTestId('services-row');
    test.skip((await rows.count()) === 0, 'the e2e tenant has no active services');

    const table = page.getByRole('table', { name: 'Servicios' });
    await expect(table.locator('thead')).toHaveClass(/sticky/);
    await expect(table.locator('thead th').filter({ hasText: 'Nombre' })).toHaveAttribute('aria-sort', 'ascending');
    await expect(table.locator('thead th').filter({ hasText: 'Precio' })).toHaveClass(/text-right/);
    await expect(rows.first().locator('[data-tone]').first()).toHaveText(/^(Activo|Eliminado)$/);

    const footer = page.getByTestId('list-footer');
    const text = (await footer.textContent()) ?? '';
    const paged = /^1–25 de (\d+) servicios/.exec(text);
    if (paged) {
      expect(Number(paged[1])).toBeGreaterThan(25);
      await expect(rows).toHaveCount(25);
      await page.getByRole('button', { name: 'Página siguiente' }).click();
      await expect(footer).toContainText(new RegExp(`^26–\\d+ de ${paged[1]} servicios`));
    } else {
      expect(text).toMatch(/^\d+ de \d+ servicios/);
      expect(await rows.count()).toBeLessThanOrEqual(25);
      await expect(page.getByRole('navigation', { name: 'Paginación' })).toHaveCount(0);
    }
  });

  test('axe finds no serious violations at 1280', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const route of ROUTES) {
      await openList(page, route.path);
      await expectNoSeriousViolations(page, route.path);
    }
  });
});
