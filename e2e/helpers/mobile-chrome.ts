import { expect, type Locator, type Page } from '@playwright/test';

/** Mobile layout may render duplicate headers; target the visible one. */
export const visiblePageHeader = (page: Page): Locator =>
  page.getByTestId('page-header').filter({ visible: true }).first();

/** Mobile layout may render duplicate app bars; target the visible one. */
export const visibleMobileAppBar = (page: Page): Locator =>
  page.getByTestId('mobile-app-bar').filter({ visible: true }).first();

/** Sticky save/CTA bar on ticket create/edit (may briefly duplicate while streaming). */
export const visibleMobileStickyActionBar = (page: Page): Locator =>
  page.getByTestId('mobile-sticky-action-bar').filter({ visible: true }).first();

/**
 * ZIG-I18-6: a sticky action bar takes the dock's place. Only one bar is ever at
 * the bottom, and the last thing on the page can be scrolled clear of it.
 */
export const expectStickyActionReplacesDock = async (page: Page): Promise<void> => {
  const sticky = visibleMobileStickyActionBar(page);
  await expect(sticky).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('mobile-dock-shell')).toHaveCount(0);
  const viewport = page.viewportSize();
  const box = await sticky.boundingBox();
  expect(box && viewport).toBeTruthy();
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
};

/** Scrolls to the bottom and checks the target ends up fully above the sticky bar. */
export const expectReachableAboveStickyBar = async (page: Page, target: Locator): Promise<void> => {
  await target.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const sticky = visibleMobileStickyActionBar(page);
  const stickyBox = await sticky.boundingBox();
  const targetBox = await target.boundingBox();
  expect(stickyBox && targetBox).toBeTruthy();
  expect(targetBox!.y + targetBox!.height).toBeLessThanOrEqual(stickyBox!.y + 1);
};
