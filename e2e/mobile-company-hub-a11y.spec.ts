import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  e2eCredentialsSkipReason,
  hasE2eCredentials,
  login,
} from './helpers/auth';

/**
 * ZIG-I3-7 — accessibility gate for the Mi empresa hub (read-only: no saves).
 * Same policy as accessibility.spec.ts: fail on serious/critical WCAG A/AA
 * violations; color-contrast stays disabled until the palette work lands.
 */
const seriousViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .disableRules(['color-contrast'])
    .analyze();
  return results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
};

const expectNoSeriousViolations = async (page: Page) => {
  const violations = await seriousViolations(page);
  expect(
    violations,
    `axe violations: ${violations.map((v) => `${v.id} (${v.impact})`).join(', ')}`,
  ).toEqual([]);
};

test.describe('Mi empresa hub accessibility', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
  });

  for (const [name, path, ready] of [
    ['Datos', '/company', 'company-readiness-banner'],
    ['Equipo', '/company/equipo', 'team-member-card'],
    ['Roles', '/company/roles', 'role-card'],
  ] as const) {
    test(`${name} tab has no serious axe violations @375px`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(path);
      const forbidden = page.getByText('Acceso denegado');
      if (await forbidden.isVisible().catch(() => false)) {
        test.skip(true, `Current E2E user cannot open ${name}`);
      }
      await expect(page.getByTestId(ready).first()).toBeVisible();
      await expectNoSeriousViolations(page);
    });
  }

  test('role editor matrix is labelled and has no serious axe violations', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/company/roles');
    const forbidden = page.getByText('Acceso denegado');
    if (await forbidden.isVisible().catch(() => false)) {
      test.skip(true, 'Current E2E user cannot read roles');
    }
    await page.getByTestId('role-card').first().click();
    await expect(page.getByRole('checkbox', { name: 'Ver Tickets' })).toBeVisible();

    // Every matrix checkbox has a unique accessible name.
    const names = await page
      .getByRole('checkbox')
      .evaluateAll((boxes) => boxes.map((box) => box.getAttribute('aria-label')));
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(names.length);

    await expectNoSeriousViolations(page);
  });

  test('hub tabs are links with aria-current on the active one', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/company/equipo');
    const nav = page.getByRole('navigation', { name: 'Secciones de Mi empresa' });
    await expect(nav).toBeVisible();
    await expect(
      nav.getByRole('link', { name: /^Equipo/ }).filter({ visible: true }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      nav.locator('[aria-current="page"]').filter({ visible: true }),
    ).toHaveCount(1);
  });
});
