import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import {
  addComposerLine,
  addInlineComposerLine,
  createClientInComposer,
} from './helpers/ticket-composer';

/**
 * ZIG-I5 end to end on Pixel 5: dock + → Nuevo presupuesto → composer with a
 * catalog line and an inline line (not saved to the catalog) and Vence 15 días
 * → Guardar presupuesto → review → Descargar PDF → Ver presupuesto (Abierto).
 * Plus a reduced-motion pass. This spec saves data: run it in CI or against a
 * scratch database, never against production.
 */

const LINES_LABEL = 'Servicios del presupuesto';

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

const openPresupuestoComposerFromDock = async (page: Page) => {
  await page.goto('/dashboard');
  const dock = page.getByTestId('mobile-bottom-tab-bar');
  await dock.getByRole('button', { name: 'Crear' }).click();
  await Promise.all([
    page.waitForURL(/\/presupuestos\/create/),
    dock.getByRole('menuitem', { name: /Nuevo presupuesto/ }).click(),
  ]);
  await expect(
    page.getByRole('heading', { name: 'Cliente', exact: true }),
  ).toBeVisible({ timeout: 15_000 });
};

test.describe('Presupuesto creation (mobile)', () => {
  test.setTimeout(240_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('dock + → composer (catalog + inline line, Vence) → review → PDF → detail', async ({
    page,
  }) => {
    const suffix = Date.now().toString().slice(-8);
    const clientName = `Quote Flow ${suffix}`;
    const inlineName = `Cambio de capacitor ${suffix}`;

    await openPresupuestoComposerFromDock(page);
    // Quotes have no Captura rápida shortcut (the dock menu keeps its own).
    await expect(
      page.getByRole('link', { name: 'Captura rápida' }).filter({ visible: true }),
    ).toHaveCount(0);

    await createClientInComposer(page, {
      name: clientName,
      phone: `965${suffix.slice(-7)}`,
    });
    await addComposerLine(page, { quantity: 1, price: 4200 }, 0, LINES_LABEL);
    await addInlineComposerLine(page, { name: inlineName, price: 850 }, LINES_LABEL);
    const lines = page.getByRole('list', { name: LINES_LABEL });
    await expect(lines.getByText('Nuevo', { exact: true })).toBeVisible();
    await expect(page.getByTestId('composer-total')).toHaveText('$5,050.00');

    await page.getByRole('button', { name: '15 días' }).click();
    await expect(page.getByRole('button', { name: /^Vence/ })).toContainText('en 15 días');

    const save = page.getByRole('button', { name: 'Guardar presupuesto' }).first();
    await expect(save).toBeEnabled();
    await save.click();
    await page.waitForURL(/\/presupuestos\/\d+\/listo$/, { timeout: 60_000 });
    const presupuestoId = page.url().match(/\/presupuestos\/(\d+)/)?.[1];
    expect(presupuestoId).toBeTruthy();

    await expect(
      page.getByRole('heading', { name: `Presupuesto #${presupuestoId} guardado` }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('review-total')).toHaveText('$5,050.00');
    const reviewLines = page.getByRole('list', { name: LINES_LABEL });
    await expect(reviewLines.getByText(inlineName)).toBeVisible();
    await expect(page.getByText(/Pagado completo|Finalizar/)).toHaveCount(0);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      page.getByRole('button', { name: /Descargar PDF/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^presupuesto_.*\.pdf$/);

    await page.getByRole('link', { name: 'Ver presupuesto' }).first().click();
    await page.waitForURL(new RegExp(`/presupuestos/${presupuestoId}$`));
    await expect(
      page.getByTestId('presupuesto-status').filter({ visible: true }).first(),
    ).toHaveText('Abierto', { timeout: 15_000 });

    // The inline line never reached the catalog.
    await page.goto('/services');
    await expect(page.getByText(inlineName)).toHaveCount(0);
  });
});

test.describe('Presupuesto creation (mobile, reduced motion)', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('no non-essential animation in the composer and the line sheet', async ({
    page,
  }) => {
    const hydrationErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydrat/i.test(message.text())) {
        hydrationErrors.push(message.text());
      }
    });

    await openPresupuestoComposerFromDock(page);
    await page.waitForTimeout(150);
    expect(await runningAnimations(page)).toBe(0);

    await page.getByRole('button', { name: 'Agregar servicio' }).click();
    const sheet = page.getByRole('dialog', { name: 'Agregar servicio' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('radio', { name: /Nuevo/ }).click();
    await page.waitForTimeout(100);
    expect(await runningAnimations(page)).toBe(0);
    await sheet.getByRole('button', { name: 'Cancelar' }).click();
    await expect(sheet).toBeHidden();

    expect(hydrationErrors).toEqual([]);
  });
});
