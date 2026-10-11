import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import {
  assertMobileMetrics,
  formatMetrics,
  measureMobileMetrics,
  measurePage,
} from './helpers/mobile-metrics';

/**
 * ZIG-I18-10: goal metric on the primary phone screens, iPhone-class width.
 * `MOBILE_METRICS_REPORT=1` prints every screen without asserting (audit mode).
 */
test.describe('Mobile metrics (ZIG-I18-10)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('helper measures a static page (fixture)', async ({ page }) => {
    await page.setContent(`
      <body style="font-size:16px">
        <p style="font-size:16px">Texto grande suficiente</p>
        <p style="font-size:11px">chico chico</p>
        <button style="width:30px;height:30px">x</button>
        <button style="width:60px;height:60px">Grande</button>
        <input style="font-size:12px" aria-label="chiquito" />
        <p style="font-size:11px;display:none">oculto</p>
      </body>`);
    const m = await page.evaluate(measureMobileMetrics, { minTarget: 44 });
    expect(m.smallChars).toBe('chicochico'.length);
    expect(m.smallShare).toBeGreaterThan(0.2);
    expect(m.smallTargets.map((t) => t.label)).toEqual(expect.arrayContaining(['x', 'chiquito']));
    expect(m.smallTargets.some((t) => t.label === 'Grande')).toBe(false);
    expect(m.smallInputs).toHaveLength(1);
    expect(formatMetrics('fixture', m)).toContain('fixture');
  });

  const SCREENS: Array<{ name: string; path: string }> = [
    { name: 'Hoy', path: '/dashboard' },
    { name: 'Tickets', path: '/tickets' },
    { name: 'Cobranza', path: '/cobranza' },
    { name: 'Anotar', path: '/anotar' },
    { name: 'Nuevo ticket', path: '/tickets/create' },
    { name: 'Clientes', path: '/clients' },
  ];

  test('Login: sentence-case labels at 14 px or more, no sub-44px targets (ZIG-I18-12)', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').waitFor({ state: 'visible', timeout: 30_000 });
    await page.getByRole('button', { name: /Primera vez en ZigZag/i }).click();
    await page.waitForTimeout(500);
    const label = page.locator('label[for="email"]');
    await expect(label).toHaveText('Correo electrónico');
    const fontSize = await label.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(14);
    const transform = await label.evaluate((el) => getComputedStyle(el).textTransform);
    expect(transform).toBe('none');
    const metrics = await measurePage(page);
    if (process.env.MOBILE_METRICS_REPORT === '1') {
      console.log(formatMetrics('Login', metrics));
      return;
    }
    assertMobileMetrics('Login', metrics);
  });

  test.describe('primary screens', () => {
    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
      await ensureTenantCompany(page);
    });

    test('Detalle de ticket: under 10% small text, no sub-44px targets', async ({ page }) => {
      await page.goto('/tickets');
      await page.waitForLoadState('load');
      const card = page
        .getByRole('button', { name: /^(Ver|Editar) ticket \d+$/ })
        .filter({ visible: true })
        .filter({ hasText: 'Pagado' })
        .first();
      await expect(card).toBeVisible({ timeout: 30_000 });
      await card.click();
      await page.waitForURL(/\/tickets\/\d+/);
      await page.waitForTimeout(2000);
      const metrics = await measurePage(page);
      if (process.env.MOBILE_METRICS_REPORT === '1') {
        console.log(formatMetrics('Detalle de ticket', metrics));
        return;
      }
      assertMobileMetrics('Detalle de ticket', metrics);
    });

    test('Cobrar (sheet): under 10% small text, no sub-44px targets', async ({ page }) => {
      await page.goto('/cobranza');
      await page.waitForLoadState('load');
      await page.getByRole('button', { name: 'Cobrar', exact: true }).first().click();
      await expect(page.getByRole('button', { name: /^Pagó todo/ })).toBeVisible();
      await page.getByRole('button', { name: 'Pagó una parte' }).click();
      await page.waitForTimeout(500);
      const metrics = await measurePage(page);
      if (process.env.MOBILE_METRICS_REPORT === '1') {
        console.log(formatMetrics('Cobrar', metrics));
        return;
      }
      assertMobileMetrics('Cobrar', metrics);
    });

    for (const screen of SCREENS) {
      test(`${screen.name}: under 10% small text, no sub-44px targets`, async ({ page }) => {
        await page.goto(screen.path);
        await page.waitForLoadState('load');
        await page.waitForTimeout(2000);
        const metrics = await measurePage(page);
        if (process.env.MOBILE_METRICS_REPORT === '1') {
          console.log(formatMetrics(screen.name, metrics));
          return;
        }
        assertMobileMetrics(screen.name, metrics);
      });
    }
  });
});
