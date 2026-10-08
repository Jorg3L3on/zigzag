import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';

const setExperienceMode = async (
  page: import('@playwright/test').Page,
  mode: 'Campo' | 'Oficina' | 'Automático (1 usuario = Campo)',
) => {
  await page.goto('/company');
  // ZIG-I3-2: on mobile, Configuración is a collapsed section of the Datos tab.
  // The toggle is enabled only once the page hydrates in mobile mode; retry the
  // open-section / open-select steps so slow CI hydration cannot race them.
  const configuracion = page.getByRole('button', { name: /^Configuración/ });
  await expect(configuracion).toBeEnabled({ timeout: 30_000 });
  const experience = page
    .getByRole('combobox', { name: 'Experiencia de inicio' })
    .locator('visible=true')
    .first();
  await expect(async () => {
    if ((await configuracion.getAttribute('aria-expanded')) !== 'true') {
      await configuracion.click();
    }
    await expect(experience).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });

  const option = page.getByRole('option', { name: mode, exact: true });
  await expect(async () => {
    if (!(await option.isVisible())) {
      await experience.click();
    }
    await expect(option).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await option.click();
  await page
    .getByRole('button', { name: /Guardar cambios|Guardar/i })
    .locator('visible=true')
    .first()
    .click();
  await expect(
    page.getByText(/Empresa actualizada|guardado|cambios/i).first(),
  )
    .toBeVisible({ timeout: 15_000 })
    .catch(() => undefined);
};

/**
 * Epic A #429 — mobile campo home must not flash office charts.
 */
test.describe('Mobile campo Hoy home (Epic A)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('hides revenue charts and shows Hoy-first campo layout', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'mobile-chrome',
      'Campo mobile composition is validated on Pixel viewport',
    );

    try {
      await setExperienceMode(page, 'Campo');

      await page.goto('/dashboard');
      await expect(
        page.getByText(/Tu día en el campo|Trabajo de hoy/i).first(),
      ).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('#dashboard-revenue-chart-title')).toHaveCount(
        0,
      );
      await expect(page.getByTestId('mobile-bottom-tab-bar')).toBeVisible();
    } finally {
      // Shared CI DB — restore office so later specs looking for "Dashboard" pass.
      await setExperienceMode(page, 'Oficina');
    }
  });
});
