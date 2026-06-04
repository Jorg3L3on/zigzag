import { expect, type Locator, type Page } from '@playwright/test';
import {
  e2eEmail,
  e2ePassword,
  ensureSystemCompany,
  hasE2eCredentials,
  login,
  loginAsSystemUser,
} from './auth';

export {
  e2eEmail,
  e2ePassword,
  ensureSystemCompany,
  hasE2eCredentials,
  login,
  loginAsSystemUser,
};

export const scrollPageDown = async (page: Page) => {
  await page.evaluate(() => {
    const target = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      1200,
    );
    window.scrollTo(0, target);
  });
};

export const expectPinnedNavWhileScrolling = async (
  page: Page,
  nav: Locator,
  expectedPosition: 'fixed' | 'sticky',
) => {
  await expect(nav).toBeVisible();

  const position = await nav.evaluate(
    (el) => window.getComputedStyle(el).position,
  );
  expect(position).toBe(expectedPosition);

  const yBeforeScroll = (await nav.boundingBox())?.y ?? -1;
  await scrollPageDown(page);
  await expect(nav).toBeVisible();

  const yAfterScroll = (await nav.boundingBox())?.y ?? -1;
  expect(yAfterScroll).toBeLessThanOrEqual(yBeforeScroll + 2);
  expect(yAfterScroll).toBeGreaterThanOrEqual(0);
};
