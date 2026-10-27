import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import { visiblePageHeader } from './helpers/mobile-chrome';

/**
 * ZIG-34 — Mi empresa is one sidebar link: the hub carries its own
 * Datos · Equipo · Roles navigation (side nav from lg, tabs below).
 */

const desktopSidebar = (page: Page) =>
  page.locator('[data-sidebar="sidebar"]').filter({ visible: true }).first();
const plataforma = (page: Page) =>
  desktopSidebar(page)
    .locator('[data-sidebar="group"]')
    .filter({ has: page.getByText('Plataforma', { exact: true }) });
const sidebarTrigger = (page: Page) =>
  page.locator('[data-sidebar="trigger"]').filter({ visible: true }).first();
// A second copy of the hub nav can mount right after goto; use the one on screen.
const hubSideNav = (page: Page) =>
  page.getByTestId('company-hub-side-nav').filter({ visible: true }).first();

test.describe('Mi empresa in the sidebar (ZIG-34)', () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('at 1280 Mi empresa is a plain link, active on Equipo, and the hub keeps its nav', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/company/equipo');
    await expect(hubSideNav(page)).toBeVisible({ timeout: 30_000 });

    const group = plataforma(page);
    const company = group.getByRole('link', { name: 'Mi empresa', exact: true });
    await expect(company).toBeVisible();
    await expect(company).toHaveAttribute('href', '/company');
    await expect(company).toHaveAttribute('data-active', 'true');
    await expect(group.locator('[data-active="true"]')).toHaveCount(1);

    // No collapsible group and no Datos · Equipo · Roles sub-links in the sidebar.
    await expect(group.locator('[data-sidebar="menu-sub"]')).toHaveCount(0);
    await expect(group.locator('.group\\/collapsible')).toHaveCount(0);
    for (const label of ['Datos', 'Equipo', 'Roles']) {
      await expect(group.getByRole('link', { name: new RegExp(`^${label}`) })).toHaveCount(0);
    }

    // The hub still navigates itself.
    const hubNav = hubSideNav(page);
    await expect(hubNav.getByRole('link', { name: 'Perfil' })).toBeVisible();
    await expect(hubNav.getByRole('link', { name: /^Equipo/ })).toHaveAttribute('aria-current', 'page');
    await expect(hubNav.getByRole('link', { name: /^Roles/ })).toBeVisible();

    await page.goto('/company/roles');
    await expect(plataforma(page).getByRole('link', { name: 'Mi empresa', exact: true })).toHaveAttribute(
      'data-active',
      'true',
    );
    await page.goto('/company');
    await expect(plataforma(page).getByRole('link', { name: 'Mi empresa', exact: true })).toHaveAttribute(
      'data-active',
      'true',
    );
  });

  test('folded to icons the link keeps its Mi empresa tooltip', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/company');
    const sidebar = page.locator('div.peer[data-state]').first();
    await expect(sidebar).toHaveAttribute('data-state', 'expanded', { timeout: 30_000 });
    await sidebarTrigger(page).click();
    await expect(sidebar).toHaveAttribute('data-state', 'collapsed');

    const company = plataforma(page).getByRole('link', { name: 'Mi empresa', exact: true });
    await company.hover();
    await expect(page.getByRole('tooltip', { name: 'Mi empresa' })).toBeVisible();

    // Leave the sidebar as we found it for the next test.
    await sidebarTrigger(page).click();
    await expect(sidebar).toHaveAttribute('data-state', 'expanded');
  });

  test('at 375 the sheet lists one Mi empresa link and the hub keeps its tabs', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/company');
    // Two copies mount on phone (app bar + page); use the one on screen.
    const tabs = page.getByTestId('company-hub-tabs').filter({ visible: true }).first();
    await expect(tabs).toBeVisible({ timeout: 30_000 });
    for (const label of ['Datos', 'Equipo', 'Roles']) {
      await expect(tabs.getByRole('link', { name: new RegExp(`^${label}`) })).toBeVisible();
    }

    // The hub's phone app bar has no menu button; open the sheet from Hoy.
    await page.goto('/dashboard');
    await visiblePageHeader(page)
      .getByRole('button', { name: 'Abrir menú de navegación', exact: true })
      .click();
    const sheet = page.getByRole('dialog', { name: 'Menú de navegación' });
    await expect(sheet).toBeVisible();
    const company = sheet.getByRole('link', { name: 'Mi empresa', exact: true });
    await expect(company).toHaveCount(1);
    await expect(company).toHaveAttribute('href', '/company');
    await expect(sheet.locator('[data-sidebar="menu-sub"]')).toHaveCount(0);
    for (const label of ['Datos', 'Equipo', 'Roles']) {
      await expect(sheet.getByRole('link', { name: new RegExp(`^${label}`) })).toHaveCount(0);
    }
  });
});
