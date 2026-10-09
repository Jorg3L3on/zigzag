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
      await expect(
        page.getByRole('heading', { name: 'Cliente', exact: true }),
      ).toBeVisible({ timeout: 15_000 });
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
    const darkToggle = sidebar.getByRole('button', { name: /Activar modo oscuro/i });
    const lightToggle = sidebar.getByRole('button', { name: /Activar modo claro/i });
    await expect(darkToggle.or(lightToggle)).toBeVisible();

    // Start from a known light state (system may already be dark).
    if (await lightToggle.isVisible().catch(() => false)) {
      await lightToggle.click();
    }
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expectSurfaceIsLight(sidebar, 'sidebar in light mode');
    await expectSurfaceIsLight(main, 'main in light mode');

    await darkToggle.click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(lightToggle).toBeVisible();
    // The reveal attribute is cleared once the View Transition finishes.
    await expect(page.locator('html')).not.toHaveAttribute('data-theme-vt');
    await expectSurfaceIsDark(sidebar, 'sidebar after enabling dark');
    await expectSurfaceIsDark(main, 'main after enabling dark');

    await lightToggle.click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await expectSurfaceIsLight(sidebar, 'sidebar after returning to light');
    await expectSurfaceIsLight(main, 'main after returning to light');
  });

  test('theme toggle sits next to the bell in the sidebar footer, not the header', async ({
    page,
  }) => {
    await page.goto('/company');
    await expect(
      page.getByTestId('page-header').getByText('Mi empresa'),
    ).toBeVisible({ timeout: 15_000 });

    await expect(
      page
        .getByTestId('page-header')
        .getByRole('button', { name: /Activar modo (oscuro|claro)/i }),
    ).toHaveCount(0);

    const footer = page.locator('[data-sidebar="footer"]:visible').first();
    const bell = footer.getByRole('button', { name: /^Notificaciones/ });
    const toggle = footer.getByRole('button', {
      name: /Activar modo (oscuro|claro)/i,
    });
    await expect(bell).toBeVisible();
    await expect(toggle).toBeVisible();

    const bellBox = await bell.boundingBox();
    const toggleBox = await toggle.boundingBox();
    expect(bellBox).toBeTruthy();
    expect(toggleBox).toBeTruthy();
    // Same row, toggle right after the bell.
    expect(Math.abs(toggleBox!.y - bellBox!.y)).toBeLessThan(4);
    expect(toggleBox!.x).toBeGreaterThan(bellBox!.x);
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
