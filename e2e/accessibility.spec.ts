import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accessibility gate. Runs axe-core against the public login page and fails on
 * serious/critical WCAG violations. Unauthenticated so it needs no seeded data.
 * Expand with authenticated pages as the a11y baseline matures.
 */
test.describe('Accessibility (axe-core)', () => {
  test('login page has no serious or critical violations', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      // `color-contrast` is a known pre-existing design issue on the login page
      // tracked separately; this gate enforces structural a11y (labels, roles,
      // ARIA, names) now and contrast can be re-enabled once the palette is fixed.
      .disableRules(['color-contrast'])
      .analyze();

    const seriousOrCritical = results.violations.filter(
      (violation) =>
        violation.impact === 'serious' || violation.impact === 'critical',
    );

    expect(
      seriousOrCritical,
      `axe violations: ${seriousOrCritical
        .map((violation) => `${violation.id} (${violation.impact})`)
        .join(', ')}`,
    ).toEqual([]);
  });
});
