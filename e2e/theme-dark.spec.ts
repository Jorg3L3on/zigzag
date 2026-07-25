import { test, expect, type Page, type Locator } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

type Rgb = { r: number; g: number; b: number };

const parseRgb = (color: string): Rgb | null => {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) {
    return null;
  }
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
  };
};

const relativeLuminance = ({ r, g, b }: Rgb) => {
  const toLinear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  );
};

const getBackgroundLuminance = async (locator: Locator) => {
  const backgroundColor = await locator.evaluate((element) => {
    let node: Element | null = element;
    while (node) {
      const color = window.getComputedStyle(node).backgroundColor;
      if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
        return color;
      }
      node = node.parentElement;
    }
    return window.getComputedStyle(document.body).backgroundColor;
  });
  const rgb = parseRgb(backgroundColor);
  expect(
    rgb,
    `Expected parsable backgroundColor, got: ${backgroundColor}`,
  ).not.toBeNull();
  return relativeLuminance(rgb!);
};

const expectSurfaceIsDark = async (locator: Locator, label: string) => {
  const luminance = await getBackgroundLuminance(locator);
  expect(
    luminance,
    `${label} should be dark (luminance was ${luminance.toFixed(3)})`,
  ).toBeLessThan(0.35);
};

const expectSurfaceIsLight = async (locator: Locator, label: string) => {
  const luminance = await getBackgroundLuminance(locator);
  expect(
    luminance,
    `${label} should be light (luminance was ${luminance.toFixed(3)})`,
  ).toBeGreaterThan(0.7);
};

const forceTheme = async (page: Page, theme: 'dark' | 'light') => {
  await page.evaluate((nextTheme) => {
    localStorage.setItem('theme', nextTheme);
  }, theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (theme === 'dark') {
    await expect(page.locator('html')).toHaveClass(/dark/);
  } else {
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  }
};

const DARK_ROUTES = [
  {
    path: '/dashboard',
    ready: async (page: Page) => {
      await expect(page.locator('#dashboard-revenue-chart-title')).toBeVisible({
        timeout: 15_000,
      });
    },
  },
  {
    path: '/tickets',
    ready: async (page: Page) => {
      await expect(page.getByPlaceholder('Buscar tickets...')).toBeVisible({
        timeout: 15_000,
      });
    },
  },
  {
    path: '/clients',
    ready: async (page: Page) => {
      await expect(page.getByText('Clientes').first()).toBeVisible({
        timeout: 15_000,
      });
    },
  },
  {
    path: '/services',
    ready: async (page: Page) => {
      await expect(page.getByText('Servicios').first()).toBeVisible({
        timeout: 15_000,
      });
    },
  },
  {
    path: '/account',
    ready: async (page: Page) => {
      await expect(page.getByText('Mi cuenta').first()).toBeVisible({
        timeout: 15_000,
      });
    },
  },
  {
    path: '/company',
    ready: async (page: Page) => {
      await expect(page.getByText('Mi empresa').first()).toBeVisible({
        timeout: 15_000,
      });
    },
  },
  {
    path: '/tickets/create',
    ready: async (page: Page) => {
      await expect(page.getByText('Información del cliente').first()).toBeVisible({
        timeout: 15_000,
      });
    },
  },
] as const;

/**
 * Dark theme contract: html.dark + dark sidebar/main surfaces across key routes.
 * Requires E2E_EMAIL / E2E_PASSWORD (and matching tenant company).
 */
test.describe('Dark theme surfaces', () => {
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page);
    await ensureTenantCompany(page);
  });

  test('sidebar and main stay dark across key routes', async ({ page }) => {
    await forceTheme(page, 'dark');
    await expect(page.locator('html')).toHaveClass(/dark/);

    for (const route of DARK_ROUTES) {
      await page.goto(route.path);
      await route.ready(page);

      const sidebar = page.locator('[data-sidebar="sidebar"]:visible').first();
      const main = page.locator('main').first();

      await expect(sidebar).toBeVisible();
      await expect(main).toBeVisible();
      await expectSurfaceIsDark(sidebar, `sidebar on ${route.path}`);
      await expectSurfaceIsDark(main, `main on ${route.path}`);
    }
  });

  test('mode toggle switches between dark and light shell', async ({ page }) => {
    await page.goto('/tickets');
    await expect(page.getByPlaceholder('Buscar tickets...')).toBeVisible({
      timeout: 15_000,
    });

    const sidebar = page.locator('[data-sidebar="sidebar"]:visible').first();
    const main = page.locator('main').first();
    const darkToggle = page.getByRole('button', { name: /Activar modo oscuro/i });
    const lightToggle = page.getByRole('button', { name: /Activar modo claro/i });

    // Start from a known light state (system may already be dark).
    if (await lightToggle.isVisible().catch(() => false)) {
      await lightToggle.click();
    }
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expectSurfaceIsLight(sidebar, 'sidebar in light mode');
    await expectSurfaceIsLight(main, 'main in light mode');

    await darkToggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(
      page.getByRole('button', { name: /Activar modo claro/i }),
    ).toBeVisible();
    await expectSurfaceIsDark(sidebar, 'sidebar after enabling dark');
    await expectSurfaceIsDark(main, 'main after enabling dark');

    await page.getByRole('button', { name: /Activar modo claro/i }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expectSurfaceIsLight(sidebar, 'sidebar after returning to light');
    await expectSurfaceIsLight(main, 'main after returning to light');
  });

  test('theme toggle stays top-right on company page', async ({ page }) => {
    await page.goto('/company');
    await expect(
      page.getByTestId('page-header').getByText('Mi empresa'),
    ).toBeVisible({ timeout: 15_000 });

    const header = page.getByTestId('page-header');
    const toggle = header.getByRole('button', {
      name: /Activar modo (oscuro|claro)/i,
    });
    await expect(toggle).toBeVisible();

    const headerBox = await header.boundingBox();
    const toggleBox = await toggle.boundingBox();
    expect(headerBox).toBeTruthy();
    expect(toggleBox).toBeTruthy();

    // Toggle should sit in the right quarter of the header, not beside the title.
    expect(toggleBox!.x).toBeGreaterThan(headerBox!.x + headerBox!.width * 0.7);
    expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(
      headerBox!.x + headerBox!.width + 1,
    );
  });

  test('dark tickets list matches baseline', async ({ page }) => {
    await forceTheme(page, 'dark');
    await page.goto('/tickets');
    await expect(page.getByPlaceholder('Buscar tickets...')).toBeVisible({
      timeout: 15_000,
    });

    // Full shell: sidebar + main content.
    await expect(page).toHaveScreenshot('tickets-list-dark-shell.png', {
      fullPage: false,
    });
  });
});
