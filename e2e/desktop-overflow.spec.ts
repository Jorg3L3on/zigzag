import { test, expect, type Page } from '@playwright/test';
import { e2eCredentialsSkipReason, ensureTenantCompany, hasE2eCredentials, login } from './helpers/auth';
import { TEXT_SIZE_STORAGE_KEY } from '../src/lib/text-size';

/**
 * ZIG-I27-1: small desktop windows with the sidebar open (256px). `<main>` used to
 * grow with its widest table, so the page scrolled sideways and the create button
 * fell off screen. Every desktop spec runs at 1280; this one covers 1024 and 1120.
 * Read only: it opens pages and scrolls, nothing is saved.
 */
const ROUTES: { path: string; create?: RegExp }[] = [
  { path: '/tickets', create: /^Nuevo ticket$/ },
  { path: '/clients', create: /^Nuevo cliente$/ },
  { path: '/services', create: /^Nuevo servicio$/ },
  { path: '/cobranza' },
  { path: '/company/equipo', create: /^Agregar usuario$/ },
  { path: '/dashboard' },
];

const WIDTHS = [1024, 1120];

const pageOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

const expectSidebarOpen = async (page: Page) => {
  await expect(page.locator('.peer[data-side="left"]').first()).toHaveAttribute('data-state', 'expanded');
};

const expectCreateButtonInside = async (page: Page, name: RegExp, label: string) => {
  const button = page.getByRole('link', { name }).or(page.getByRole('button', { name })).filter({ visible: true }).first();
  await expect(button, `${label}: create button`).toBeVisible();
  const { right, innerWidth } = await button.evaluate((el) => ({
    right: el.getBoundingClientRect().right,
    innerWidth: window.innerWidth,
  }));
  expect(right, `${label}: create button past the right edge`).toBeLessThanOrEqual(innerWidth);
};

/** The ⋮ column is either on screen or reachable by scrolling the table's own wrapper. */
const expectLastColumnReachable = async (page: Page, label: string) => {
  const table = page.locator('main table').filter({ visible: true }).first();
  await expect(table, `${label}: table`).toBeVisible();
  const box = await table.evaluate((el) => {
    const wrapper = el.parentElement as HTMLElement;
    wrapper.scrollLeft = wrapper.scrollWidth;
    const header = el.querySelector('thead tr');
    const last = header?.lastElementChild as HTMLElement | null;
    return {
      lastRight: last?.getBoundingClientRect().right ?? 0,
      wrapperRight: wrapper.getBoundingClientRect().right,
      innerWidth: window.innerWidth,
    };
  });
  expect(box.lastRight, `${label}: last column past its card`).toBeLessThanOrEqual(box.wrapperRight + 1);
  expect(box.lastRight, `${label}: last column past the window`).toBeLessThanOrEqual(box.innerWidth);
};

test.describe('Desktop shell without overflow (ZIG-I27-1)', () => {
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  for (const width of WIDTHS) {
    test(`lists fit the window at ${width}px with the sidebar open`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const route of ROUTES) {
        const label = `${route.path} @${width}`;
        await page.goto(route.path);
        await expect(page.getByTestId('page-header').first()).toBeVisible();
        await page.waitForLoadState('networkidle');
        await expectSidebarOpen(page);
        expect(await pageOverflow(page), `${label}: document wider than the window`).toBeLessThanOrEqual(0);
        if (route.create) {
          await expectCreateButtonInside(page, route.create, label);
        }
      }
    });
  }

  test('the tickets table keeps ⋮ reachable inside its card at 1024 and 1120', async ({ page }) => {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/tickets');
      await page.waitForLoadState('networkidle');
      await expectLastColumnReachable(page, `/tickets @${width}`);
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    }
  });

  test('Texto grande at 1120 keeps Nuevo ticket on screen', async ({ page }) => {
    await page.setViewportSize({ width: 1120, height: 800 });
    await page.goto('/tickets');
    await page.evaluate((key) => window.localStorage.setItem(key, 'large'), TEXT_SIZE_STORAGE_KEY);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');
    await page.waitForLoadState('networkidle');
    expect(await pageOverflow(page), '/tickets large text: document wider than the window').toBeLessThanOrEqual(0);
    await expectCreateButtonInside(page, /^Nuevo ticket$/, '/tickets large text');
    await expectLastColumnReachable(page, '/tickets large text');
    await page.evaluate((key) => window.localStorage.removeItem(key), TEXT_SIZE_STORAGE_KEY);
  });

  test('page header and the ticket aside stay sticky at 1280', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect
      .poll(() => page.getByTestId('page-header').first().evaluate((el) => Math.round(el.getBoundingClientRect().top)))
      .toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    const firstRow = page.locator('main table tbody tr').filter({ visible: true }).first();
    test.skip((await firstRow.count()) === 0, 'No tickets in this tenant');
    await firstRow.locator('td').first().click();
    await page.waitForURL(/\/tickets\/\d+$/);
    await page.waitForLoadState('networkidle');
    const aside = page.locator('main aside[aria-label="Cobro del ticket"]');
    await expect(aside).toBeVisible();
    // A short ticket barely scrolls: make the main column tall so sticky has room to act.
    const before = await aside.evaluate((el) => {
      const spacer = document.createElement('div');
      spacer.style.height = '1600px';
      el.nextElementSibling?.appendChild(spacer);
      return el.getBoundingClientRect().top;
    });
    await page.evaluate((by) => window.scrollBy(0, by), Math.round(before) + 200);
    // lg:top-20 = 80px; a non-sticky aside would be ~200px above the window by now.
    await expect
      .poll(() => aside.evaluate((el) => Math.round(el.getBoundingClientRect().top)))
      .toBeGreaterThanOrEqual(78);
    expect(await aside.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThanOrEqual(82);
  });
});

/**
 * ZIG-I27-2: below 1280 the secondary columns give their room to Total and ⋮. With
 * everyday data the five lists fit at 1120 without scrolling (measured on the local
 * copy); the shared e2e tenant also holds adversarial rows (100-character names,
 * billion-peso saldos), so this spec asserts what holds for any data: the hidden
 * columns, no page overflow and ⋮ reachable inside the card.
 */
test.describe('Desktop tables at 1024–1280 (ZIG-I27-2)', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  const SECONDARY: { path: string; header: string }[] = [
    { path: '/tickets', header: 'Teléfono' },
    { path: '/clients', header: 'Dirección' },
    { path: '/services', header: 'Descripción' },
  ];

  test('secondary columns hide below 1280 and come back at 1280', async ({ page }) => {
    for (const { path, header } of SECONDARY) {
      for (const [width, shown] of [[1120, false], [1280, true]] as const) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        const table = page.locator('main table').filter({ visible: true }).first();
        if ((await table.count()) === 0) continue; // empty list
        const th = table.locator('thead th').filter({ hasText: header });
        if (shown) await expect(th, `${path} @${width}: ${header}`).toBeVisible();
        else await expect(th, `${path} @${width}: ${header}`).toBeHidden();
      }
    }
  });

  test('the tickets filters are labelled and share a row at 1120 and 1280 (ZIG-I27-3)', async ({ page }) => {
    for (const width of [1120, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/tickets');
      await page.waitForLoadState('networkidle');
      const trabajo = page.getByRole('combobox', { name: 'Trabajo' }).filter({ visible: true }).first();
      const fechas = page
        .getByRole('button', { name: 'Filtrar por rango de fechas del ticket' })
        .filter({ visible: true })
        .first();
      await expect(trabajo).toHaveText(/Todos los trabajos/);
      await expect(fechas).toBeVisible();
      const [a, b] = [(await trabajo.boundingBox())!, (await fechas.boundingBox())!];
      expect(Math.abs(a.y - b.y), `@${width}: Trabajo and Fechas on one row`).toBeLessThanOrEqual(2);
      expect(Math.abs(a.height - b.height), `@${width}: same height`).toBeLessThanOrEqual(1);
      await expect(page.getByTestId('tickets-balance-due')).toHaveCount(0);
    }
  });

  for (const width of WIDTHS) {
    test(`at ${width} every list keeps ⋮ reachable`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ['/tickets', '/clients', '/services', '/cobranza', '/company/equipo']) {
        await page.goto(path);
        await page.waitForLoadState('networkidle');
        if ((await page.locator('main table').filter({ visible: true }).count()) === 0) continue;
        await expectLastColumnReachable(page, `${path} @${width}`);
        expect(await pageOverflow(page), `${path} @${width}: document wider than the window`).toBeLessThanOrEqual(0);
      }
    });
  }
});
