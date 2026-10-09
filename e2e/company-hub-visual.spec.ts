import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  hasE2eCredentials,
  login,
} from './helpers/auth';

/**
 * ZIG-I3-7 — visual baselines for the Mi empresa hub (Datos · Equipo · Roles)
 * at 375px and desktop, light and dark. Read-only. Company-specific content
 * (names, emails, counts, logo) is masked so baselines survive data changes.
 *
 * Update snapshots:
 *   npm run test:e2e:visual:update
 */
const TABS = [
  { name: 'datos', path: '/company', ready: 'company-readiness-banner' },
  { name: 'equipo', path: '/company/equipo', ready: 'team-member-card' },
  { name: 'roles', path: '/company/roles', ready: 'role-card' },
] as const;

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812, ready: (id: string) => id },
  {
    name: 'desktop',
    width: 1280,
    height: 900,
    // Desktop lists use table rows / list buttons instead of cards.
    ready: (id: string) =>
      id === 'team-member-card'
        ? 'team-member-row'
        : id === 'role-card'
          ? 'role-list-item'
          : id,
  },
] as const;

const setTheme = async (page: Page, theme: 'light' | 'dark') => {
  await page.evaluate((next) => localStorage.setItem('theme', next), theme);
};

test.describe('Mi empresa hub visual baselines', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    // Same open sections for every run.
    await page.evaluate(() =>
      localStorage.removeItem('zigzag.company-form.sections'),
    );
  });

  for (const theme of ['light', 'dark'] as const) {
    for (const viewport of VIEWPORTS) {
      for (const tab of TABS) {
        test(`${tab.name} ${viewport.name} ${theme}`, async ({ page }) => {
          await page.setViewportSize({
            width: viewport.width,
            height: viewport.height,
          });
          await setTheme(page, theme);
          await page.goto(tab.path);
          await expect(
            page.getByTestId(viewport.ready(tab.ready)).filter({ visible: true }).first(),
          ).toBeVisible({ timeout: 15_000 });

          const main = page.locator('main');
          await expect(main).toHaveScreenshot(
            `company-hub-${tab.name}-${viewport.name}-${theme}.png`,
            {
              animations: 'disabled',
              mask: [
                page.getByTestId('team-member-row'),
                page.getByTestId('team-member-card'),
                page.getByTestId('role-list-item'),
                page.getByTestId('role-card'),
                page.getByTestId('company-hub-tabs').locator('span.tabular-nums'),
                page.getByRole('group', { name: 'Filtrar por estado' }),
                main.locator('h1'),
                page.getByTestId('mobile-app-bar').locator('p').nth(1),
                page.locator('input'),
                page.locator('img'),
              ],
            },
          );
        });
      }
    }
  }
});
