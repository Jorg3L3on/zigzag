import type { Locator, Page } from '@playwright/test';

/** Mobile layout may render duplicate headers; target the visible one. */
export const visiblePageHeader = (page: Page): Locator =>
  page.getByTestId('page-header').filter({ visible: true }).first();

/** Mobile layout may render duplicate app bars; target the visible one. */
export const visibleMobileAppBar = (page: Page): Locator =>
  page.getByTestId('mobile-app-bar').filter({ visible: true }).first();

/** Sticky save/CTA bar on ticket create/edit (may briefly duplicate while streaming). */
export const visibleMobileStickyActionBar = (page: Page): Locator =>
  page.getByTestId('mobile-sticky-action-bar').filter({ visible: true }).first();
