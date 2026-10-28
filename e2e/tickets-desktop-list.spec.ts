import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import { expectNoSeriousViolations } from './helpers/a11y';
import { waitForSettledLayout } from './helpers/layout';

/**
 * ZIG-I33-2 at 1280: Tickets on the desktop list standard. The header sorts the
 * whole list on the server (page 2 follows page 1), ⋯ is the only row action, there
 * is no order select, the header sticks under the app bar and the footer counts
 * «1–25 de N tickets». Read only: nothing is saved. The sort and footer checks need
 * more than 25 tickets in the tenant and skip otherwise.
 */

/** «$1,234.50» → 1234.5; «—» or anything else → NaN. */
const money = (text: string): number => {
  const match = /\$\s?([\d,]+(?:\.\d{1,2})?)/.exec(text);
  return match ? Number(match[1].replace(/,/g, '')) : Number.NaN;
};

/** The text of one column in every body row, found by its header. */
const columnTexts = (table: Locator, header: string) =>
  table.evaluate((el, name) => {
    const index = [...el.querySelectorAll('thead th')].findIndex(
      (th) => th.textContent?.trim() === name,
    );
    return [...el.querySelectorAll('tbody tr')].map((tr) => tr.children[index]?.textContent ?? '');
  }, header);

const ticketsTable = async (page: Page) => {
  const table = page.getByRole('table', { name: 'Tickets' });
  await expect(table).toBeVisible({ timeout: 30_000 });
  await waitForSettledLayout(page);
  return table;
};

const notBusy = (table: Locator) => expect(table).not.toHaveAttribute('aria-busy', 'true', { timeout: 30_000 });

const expectDescending = (values: number[], label: string) => {
  const known = values.filter(Number.isFinite);
  // Tickets without a total sort last (nulls last).
  expect(values.slice(0, known.length), `${label}: blanks after the amounts`).toEqual(known);
  for (let i = 1; i < known.length; i += 1) {
    expect(known[i], `${label}: row ${i + 1}`).toBeLessThanOrEqual(known[i - 1]);
  }
};

test.describe('Tickets en escritorio, estándar de listas (ZIG-I33-2)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('no order select, ⋯ opens the row menu, the table card and axe', async ({ page }) => {
    await page.goto('/tickets');
    const table = await ticketsTable(page);

    await expect(page.getByRole('heading', { level: 1, name: /^Tickets · \d+$/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Nuevo ticket' }).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByRole('combobox', { name: /^Ordenar/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Más filtros' })).toHaveCount(0);
    await expect(table.getByRole('columnheader', { name: /^Fecha/ })).toHaveAttribute('aria-sort', 'descending');
    await expect(table.getByRole('columnheader', { name: /^Total/ })).toHaveClass(/text-right/);
    await expect(page.getByTestId('list-footer')).toContainText(/ de \d+ tickets/);

    const row = page.getByTestId('tickets-row').first();
    await row.hover();
    // Only ⋯ in the row, before and while hovering (85563215).
    await expect(row.getByRole('button')).toHaveCount(1);
    await row.getByRole('button', { name: /^Más acciones de / }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Ver detalles' })).toBeVisible();
    // The menu never opens the row underneath.
    await expect(page).toHaveURL(/\/tickets(\?.*)?$/);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();

    await expectNoSeriousViolations(page, 'tickets-lista-1280');

    await page.goto('/presupuestos');
    await expect(page.getByRole('navigation', { name: 'Vistas de presupuestos' })).toBeVisible({
      timeout: 30_000,
    });
    await waitForSettledLayout(page);
    await expect(page.getByRole('combobox', { name: /^Ordenar/ })).toHaveCount(0);
    await expectNoSeriousViolations(page, 'presupuestos-lista-1280');
  });

  test('sorts by Total on the server: page 2 follows page 1; the header sticks; «1–25 de N tickets»', async ({
    page,
  }) => {
    await page.goto('/tickets');
    const table = await ticketsTable(page);
    const footer = page.getByTestId('list-footer');
    const total = Number(/ de (\d+) tickets/.exec(await footer.innerText())?.[1] ?? 0);
    test.skip(total <= 25, 'Needs more than 25 tickets in the tenant');
    await expect(footer).toContainText(`1–25 de ${total} tickets`);

    await table.getByRole('button', { name: 'Total' }).click();
    await expect(page).toHaveURL(/[?&]orden=total-desc/);
    await expect(table.getByRole('columnheader', { name: /^Total/ })).toHaveAttribute('aria-sort', 'descending');
    await notBusy(table);
    await expect(footer).toContainText(`1–25 de ${total} tickets`);

    const first = (await columnTexts(table, 'Total')).map(money);
    expect(first).toHaveLength(25);
    expectDescending(first, 'page 1');
    const lowestOnFirst = first.filter(Number.isFinite).at(-1);

    // The header stays under the app bar (top-16) while the rows scroll beneath it.
    await page.mouse.move(640, 600);
    await page.mouse.wheel(0, 800);
    await expect
      .poll(async () => (await table.locator('tbody tr').first().boundingBox())?.y ?? 0)
      .toBeLessThan(0);
    const head = await table.locator('thead th').first().boundingBox();
    expect(Math.abs((head?.y ?? 0) - 64), 'header under the app bar').toBeLessThanOrEqual(2);

    await page.getByRole('button', { name: 'Página 2' }).click();
    await expect(footer).toContainText(`26–`);
    await notBusy(table);
    const second = (await columnTexts(table, 'Total')).map(money);
    expectDescending(second, 'page 2');
    if (lowestOnFirst !== undefined && Number.isFinite(second[0])) {
      // Sorted over the whole list, not inside the page.
      expect(second[0]).toBeLessThanOrEqual(lowestOnFirst);
    }

    // An old link of the sort select still sorts the same way.
    await page.goto('/tickets?orden=total:asc');
    const again = await ticketsTable(page);
    await expect(again.getByRole('columnheader', { name: /^Total/ })).toHaveAttribute('aria-sort', 'ascending');
  });
});
