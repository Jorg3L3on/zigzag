import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import {
  addComposerLine,
  createClientInComposer,
  finishOnReview,
  saveComposer,
} from './helpers/ticket-composer';

/**
 * ZIG-I2 end to end on Pixel 5: dock + → Nuevo ticket → composer (2 lines) →
 * Guardar ticket → creation review → Finalizar y compartir → Descargar PDF,
 * then the ticket shows in the Tickets tab. Plus a reduced-motion pass.
 */

/**
 * Perceptible running animations (> 50 ms), ignoring loading spinners
 * (essential feedback). The reduced-motion reset shortens CSS motion to
 * 0.01 ms, which can still be caught "running" for a frame.
 */
const runningAnimations = (page: Page) =>
  page.evaluate(
    () =>
      document.getAnimations().filter((animation) => {
        if (animation.playState !== 'running') return false;
        const duration = Number(animation.effect?.getComputedTiming().duration ?? 0);
        if (!(duration > 50)) return false;
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return !(target instanceof Element && target.closest('.animate-spin'));
      }).length,
  );

/**
 * Reduced motion: entrance elements are at their final state almost at once
 * (no staggered fade / draw). BlurFade delays go up to 0.15 s plus 0.4 s of
 * animation, so 150 ms after load nothing should still be mid-animation.
 */
const expectSettledAtOnce = async (page: Page, selector: string) => {
  await page.waitForTimeout(150);
  // Skip hidden streaming placeholders (Next keeps a hidden copy for a moment).
  const opacities = await page
    .locator(selector)
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => !(node as Element).closest('[hidden]'))
        .map((node) => getComputedStyle(node as Element).opacity),
    );
  expect(opacities.length).toBeGreaterThan(0);
  expect(opacities.every((value) => value === '1')).toBe(true);
};

test.describe('Ticket creation (mobile)', () => {
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('dock + → composer → review → recibo download → Tickets tab', async ({
    page,
  }) => {
    const suffix = Date.now().toString().slice(-8);
    const clientName = `Create Flow ${suffix}`;

    await page.goto('/dashboard');
    const dock = page.getByTestId('mobile-bottom-tab-bar');
    await dock.getByRole('button', { name: 'Crear' }).click();
    await Promise.all([
      page.waitForURL(/\/tickets\/create/),
      dock.getByRole('menuitem', { name: /Nuevo ticket/ }).click(),
    ]);
    await expect(
      page.getByRole('heading', { name: 'Cliente', exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    await createClientInComposer(page, {
      name: clientName,
      phone: `964${suffix.slice(-7)}`,
    });
    await addComposerLine(page, { quantity: 3, price: 4200 });
    await addComposerLine(page, { quantity: 2, price: 175.5 }, 1);
    await expect(page.getByTestId('composer-total')).toHaveText('$12,951.00');

    const ticketId = await saveComposer(page);
    await expect(page.getByTestId('review-total')).toHaveText('$12,951.00');

    await finishOnReview(page, ticketId, { mode: 'full' });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('button', { name: /Descargar PDF/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    await page.getByRole('link', { name: 'Ver ticket' }).first().click();
    await page.waitForURL(new RegExp(`/tickets/${ticketId}$`));
    await expect(
      page.getByText(/Finalizado ·/).filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // The detail page's sticky recibo action hides the dock; go back to Hoy.
    await page.goto('/dashboard');
    const ticketsTab = page
      .getByTestId('mobile-bottom-tab-bar')
      .getByRole('link', { name: 'Tickets' });
    await Promise.all([page.waitForURL(/\/tickets$/), ticketsTab.click()]);
    await expect(ticketsTab).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText(clientName).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe('Ticket creation (mobile, reduced motion)', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('no non-essential animation in the dock, composer and review', async ({
    page,
  }) => {
    const hydrationErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydrat/i.test(message.text())) {
        hydrationErrors.push(message.text());
      }
    });

    await page.goto('/dashboard');
    const dock = page.getByTestId('mobile-bottom-tab-bar');
    await expect(dock).toBeVisible();
    await dock.getByRole('button', { name: 'Crear' }).click();
    await expect(dock.getByRole('menu')).toBeVisible();
    expect(await runningAnimations(page)).toBe(0);
    await page.keyboard.press('Escape');

    await page.goto('/tickets/create');
    await expect(
      page.getByRole('heading', { name: 'Cliente', exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expectSettledAtOnce(page, '[data-blur-fade]');
    await page.getByRole('button', { name: 'Agregar servicio' }).click();
    await expect(page.getByRole('dialog', { name: 'Agregar servicio' })).toBeVisible();
    expect(await runningAnimations(page)).toBe(0);
    await page.keyboard.press('Escape');

    await page.goto('/tickets');
    await expect(
      page.getByRole('button', { name: /^(Ver|Editar) ticket \d+$/ }).first(),
    ).toBeVisible({ timeout: 15_000 });
    const firstId = (
      await page.locator('main').innerText()
    ).match(/#(\d{3,})/)?.[1];
    test.skip(!firstId, 'No ticket to open the review screen with');
    await page.goto(`/tickets/${firstId}/listo`);
    // Hard navigation: Next may briefly hold a hidden streamed copy.
    await expect(
      page.getByTestId('review-header').filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expectSettledAtOnce(page, '[data-blur-fade]');
    await expectSettledAtOnce(page, '[data-draw-check] circle');
    // Motion primitives keep SSR markup identical under reduced motion.
    expect(hydrationErrors).toEqual([]);
  });
});
