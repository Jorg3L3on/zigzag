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

/** The dock stays on every page (ZIG-08); a sticky action bar must sit fully above it. */
export const expectStickyActionAboveDock = async (page: Page): Promise<void> => {
  const sticky = visibleMobileStickyActionBar(page);
  const dock = page.getByTestId('mobile-dock-shell').filter({ visible: true }).first();
  await expect(sticky).toBeVisible({ timeout: 15_000 });
  await expect(dock).toBeVisible();
  const stickyBox = await sticky.boundingBox();
  const dockBox = await dock.boundingBox();
  expect(stickyBox && dockBox).toBeTruthy();
  expect(stickyBox!.y + stickyBox!.height).toBeLessThanOrEqual(dockBox!.y);
};
