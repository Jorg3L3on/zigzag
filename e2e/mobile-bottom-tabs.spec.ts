import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import { expectReachableAboveStickyBar, expectStickyActionReplacesDock } from './helpers/mobile-chrome';

test.describe('Mobile bottom dock', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('shows Hoy / Tickets / + / Cobranza / Más on dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    const tabBar = page.getByTestId('mobile-bottom-tab-bar');
    await expect(tabBar).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Hoy' })).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Tickets' })).toBeVisible();
    await expect(tabBar.getByRole('button', { name: 'Crear' })).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Anotar' })).toHaveCount(0);
    await expect(tabBar.getByRole('link', { name: 'Cobranza' })).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Presupuestos' })).toHaveCount(0);
    await expect(tabBar.getByRole('link', { name: 'Clientes' })).toHaveCount(0);
    await expect(tabBar.getByRole('button', { name: /Más/i })).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Hoy' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('navigates Cobranza and Tickets', async ({ page }) => {
    await page.goto('/dashboard');

    const tabBar = page.getByTestId('mobile-bottom-tab-bar');
    await expect(tabBar).toBeVisible();

    const cobranzaTab = tabBar.getByRole('link', { name: 'Cobranza' });
    await expect(cobranzaTab).toHaveAttribute('href', '/cobranza');
    await Promise.all([
      page.waitForURL(/\/cobranza/),
      cobranzaTab.click(),
    ]);
    await expect(cobranzaTab).toHaveAttribute('aria-current', 'page');

    const ticketsTab = tabBar.getByRole('link', { name: 'Tickets' });
    await expect(ticketsTab).toHaveAttribute('href', '/tickets');
    await Promise.all([
      page.waitForURL(/\/tickets$/),
      ticketsTab.click(),
    ]);
    await expect(ticketsTab).toHaveAttribute('aria-current', 'page');
  });

  test('lights Tickets (not Más) on the tickets list', async ({ page }) => {
    await page.goto('/tickets');

    const tabBar = page.getByTestId('mobile-bottom-tab-bar');
    await expect(tabBar).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Tickets' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(tabBar.getByRole('link', { name: 'Hoy' })).not.toHaveAttribute(
      'aria-current',
      'page',
    );
    // The page header drops Nuevo ticket on phones (the dock's + creates it, ZIG-I13-7);
    // the list itself is on screen.
    await expect(page.getByTestId('tickets-balance-due')).toBeVisible();
  });

  test('+ opens the create menu and navigates to Nuevo ticket', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    const tabBar = page.getByTestId('mobile-bottom-tab-bar');
    const plus = tabBar.getByRole('button', { name: 'Crear' });
    await expect(plus).toHaveAttribute('aria-expanded', 'false');
    await plus.click();

    const menu = tabBar.getByRole('menu', { name: 'Crear' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveCount(4);
    await expect(
      menu.getByRole('menuitem', { name: /Nuevo presupuesto/ }),
    ).toHaveAttribute('href', '/presupuestos/create');
    await expect(
      menu.getByRole('menuitem', { name: /Anotar trabajo/ }),
    ).toHaveAttribute('href', '/anotar');
    await expect(
      menu.getByRole('menuitem', { name: /Nuevo cliente/ }),
    ).toHaveAttribute('href', '/clients/new');

    await Promise.all([
      page.waitForURL(/\/tickets\/create/),
      menu.getByRole('menuitem', { name: /Nuevo ticket/ }).click(),
    ]);
  });

  test('+ menu reaches Anotar trabajo and closes on Escape', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    const tabBar = page.getByTestId('mobile-bottom-tab-bar');
    const plus = tabBar.getByRole('button', { name: 'Crear' });
    await plus.click();
    await expect(tabBar.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tabBar.getByRole('menu')).toHaveCount(0);
    await expect(plus).toHaveAttribute('aria-expanded', 'false');

    await plus.click();
    await Promise.all([
      page.waitForURL(/\/anotar/),
      tabBar.getByRole('menuitem', { name: /Anotar trabajo/ }).click(),
    ]);
    await expect(tabBar.getByRole('menu')).toHaveCount(0);
  });

  test('a sticky action bar replaces the dock on ticket create', async ({
    page,
  }) => {
    await page.goto('/tickets/create');

    await expectStickyActionReplacesDock(page);
  });

  test('a sticky action bar replaces the dock on ticket edit', async ({
    page,
  }) => {
    await page.goto('/tickets');

    const editButton = page
      .getByRole('button', { name: /Editar ticket/i })
      .first();
    if (!(await editButton.isVisible().catch(() => false))) {
      test.skip(true, 'No editable ticket available for sticky action test');
      return;
    }

    await editButton.click();
    await page.waitForURL(/\/tickets\/\d+\/edit/, { timeout: 30_000 });

    await expectStickyActionReplacesDock(page);
  });

  test('Más opens the existing navigation sheet', async ({ page }) => {
    await page.goto('/dashboard');

    const tabBar = page.getByTestId('mobile-bottom-tab-bar');
    await expect(tabBar).toBeVisible();
    // The theme toggle lives only in the sheet footer, not in the app bar.
    await expect(
      page.getByRole('button', { name: /Activar modo (oscuro|claro)/ }).filter({ visible: true }),
    ).toHaveCount(0);
    await tabBar.getByRole('button', { name: /Más/i }).click();

    const navDialog = page.getByRole('dialog', { name: 'Menú de navegación' });
    await expect(navDialog).toBeVisible();
    await expect(navDialog.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await expect(navDialog.getByRole('link', { name: 'Tickets' })).toBeVisible();
    await expect(
      navDialog.getByRole('link', { name: 'Anotar trabajo' }),
    ).toHaveAttribute('href', '/anotar');
    await expect(navDialog.getByRole('button', { name: /^Notificaciones/ })).toBeVisible();
    await expect(
      navDialog.getByRole('button', { name: /Activar modo (oscuro|claro)/ }),
    ).toBeVisible();
  });

  test('Presupuestos stays reachable from the + menu and the Más sheet (ZIG-I18-6)', async ({ page }) => {
    await page.goto('/dashboard');
    const tabBar = page.getByTestId('mobile-bottom-tab-bar');
    await tabBar.getByRole('button', { name: 'Crear' }).click();
    await expect(tabBar.getByRole('menuitem', { name: /Nuevo presupuesto/ })).toBeVisible();
    await page.keyboard.press('Escape');

    await tabBar.getByRole('button', { name: /Más/i }).click();
    const navDialog = page.getByRole('dialog').filter({ visible: true }).first();
    await expect(navDialog.getByRole('link', { name: 'Presupuestos' })).toBeVisible();
  });

  test('dock labels are fully visible at 333 px and the dock is opaque (ZIG-I18-6)', async ({ page }) => {
    await page.setViewportSize({ width: 333, height: 700 });
    await page.goto('/dashboard');
    const shell = page.getByTestId('mobile-dock-shell');
    await expect(shell).toBeVisible();
    const clipped = await shell.evaluate((el) =>
      [...el.querySelectorAll<HTMLElement>('a span, button span')]
        .filter((s) => s.textContent && s.scrollWidth > s.clientWidth + 1)
        .map((s) => s.textContent),
    );
    expect(clipped, 'no truncated dock label').toEqual([]);
    const bg = await shell.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toMatch(/rgba\(.*,\s*0?\.\d+\)$/);
  });

  test('Anotar payment choices and the last field sit clear of the single bottom bar', async ({ page }) => {
    await page.goto('/anotar');
    await expect(page.getByText('Trabajo del día')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('mobile-dock-shell')).toHaveCount(0);
    await expectReachableAboveStickyBar(page, page.getByRole('button', { name: 'Pendiente', exact: true }));
    await expectReachableAboveStickyBar(page, page.getByRole('link', { name: 'Ticket con varios servicios' }));
  });
});
