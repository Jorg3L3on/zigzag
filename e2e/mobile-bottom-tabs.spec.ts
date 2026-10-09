import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import { visibleMobileStickyActionBar } from './helpers/mobile-chrome';

test.describe('Mobile bottom dock', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('shows Hoy / Tickets / + / Clientes / Más on dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    const tabBar = page.getByTestId('mobile-bottom-tab-bar');
    await expect(tabBar).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Hoy' })).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Tickets' })).toBeVisible();
    await expect(tabBar.getByRole('button', { name: 'Crear' })).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Anotar' })).toHaveCount(0);
    await expect(tabBar.getByRole('link', { name: 'Clientes' })).toBeVisible();
    await expect(tabBar.getByRole('button', { name: /Más/i })).toBeVisible();
    await expect(tabBar.getByRole('link', { name: 'Hoy' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('navigates Clientes and Tickets', async ({ page }) => {
    await page.goto('/dashboard');

    const tabBar = page.getByTestId('mobile-bottom-tab-bar');
    await expect(tabBar).toBeVisible();

    const clientsTab = tabBar.getByRole('link', { name: 'Clientes' });
    await expect(clientsTab).toHaveAttribute('href', '/clients');
    await Promise.all([
      page.waitForURL(/\/clients/),
      clientsTab.click(),
    ]);
    await expect(clientsTab).toHaveAttribute('aria-current', 'page');

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
    await expect(
      page.getByRole('link', { name: 'Nuevo ticket' }).first(),
    ).toBeVisible();
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
    await expect(menu.getByRole('menuitem')).toHaveCount(3);
    await expect(
      menu.getByRole('menuitem', { name: /Captura rápida/ }),
    ).toHaveAttribute('href', '/anotar');
    await expect(
      menu.getByRole('menuitem', { name: /Nuevo cliente/ }),
    ).toHaveAttribute('href', '/clients/new');

    await Promise.all([
      page.waitForURL(/\/tickets\/create/),
      menu.getByRole('menuitem', { name: /Nuevo ticket/ }).click(),
    ]);
  });

  test('+ menu reaches Captura rápida and closes on Escape', async ({
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
      tabBar.getByRole('menuitem', { name: /Captura rápida/ }).click(),
    ]);
    await expect(tabBar.getByRole('menu')).toHaveCount(0);
  });

  test('hides tabs on ticket create when sticky action bar is present', async ({
    page,
  }) => {
    await page.goto('/tickets/create');

    await expect(visibleMobileStickyActionBar(page)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('mobile-bottom-tab-bar')).toHaveCount(0);
  });

  test('hides tabs on ticket edit when sticky action bar is present', async ({
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

    await expect(visibleMobileStickyActionBar(page)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId('mobile-bottom-tab-bar')).toHaveCount(0);
  });

  test('Más opens the existing navigation sheet', async ({ page }) => {
    await page.goto('/dashboard');

    const tabBar = page.getByTestId('mobile-bottom-tab-bar');
    await expect(tabBar).toBeVisible();
    await tabBar.getByRole('button', { name: /Más/i }).click();

    const navDialog = page.getByRole('dialog', { name: 'Menú de navegación' });
    await expect(navDialog).toBeVisible();
    await expect(navDialog.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await expect(navDialog.getByRole('link', { name: 'Tickets' })).toBeVisible();
    await expect(
      navDialog.getByRole('link', { name: 'Captura rápida' }),
    ).toHaveAttribute('href', '/anotar');
  });
});
