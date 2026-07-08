import type { Locator, Page } from '@playwright/test';

/** Mobile layout may render duplicate headers; target the visible one. */
export const visiblePageHeader = (page: Page): Locator =>
  page.getByTestId('page-header').first();

/** Mobile layout may render duplicate app bars; target the visible one. */
export const visibleMobileAppBar = (page: Page): Locator =>
  page.getByTestId('mobile-app-bar').first();
