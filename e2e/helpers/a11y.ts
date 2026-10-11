import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * Same policy as the other a11y specs: fail on serious/critical WCAG A/AA
 * violations; color-contrast stays off until the palette work lands.
 */
export const expectNoSeriousViolations = async (
  page: Page,
  label = "page",
  { disable = [] }: { disable?: string[] } = {},
) => {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .disableRules(["color-contrast", ...disable])
    .analyze();
  const violations = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    violations,
    `${label}: axe violations: ${violations.map((v) => `${v.id} (${v.impact})`).join(", ")}`,
  ).toEqual([]);
};
