import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import { extractPdfText, pageText } from '../src/test/pdf-text';

/**
 * ZIG-I11-3: Lema o giro saved in Mi empresa › Datos › Configuración prints
 * under the company name on the presupuesto PDF (design 2a). Restores the
 * previous value at the end.
 */
const openConfiguracion = async (page: Page) => {
  await page.goto('/company');
  const forbidden = page.getByText('Acceso denegado');
  if (await forbidden.isVisible().catch(() => false)) {
    test.skip(true, 'Current E2E user cannot manage the company');
  }
  const configuracion = page.getByRole('button', { name: /^Configuración/ });
  await expect(configuracion).toBeEnabled({ timeout: 30_000 });
  const tagline = page.getByLabel('Lema o giro').locator('visible=true').first();
  await expect(async () => {
    if ((await configuracion.getAttribute('aria-expanded')) !== 'true') {
      await configuracion.click();
    }
    await expect(tagline).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  return tagline;
};

const saveTagline = async (page: Page, value: string) => {
  const tagline = await openConfiguracion(page);
  await tagline.fill(value);
  await page
    .getByTestId('mobile-sticky-action-bar')
    .getByRole('button', { name: 'Guardar cambios' })
    .click();
  await expect(page.getByText('Empresa actualizada correctamente').first()).toBeVisible({
    timeout: 15_000,
  });
};

test.describe('Lema o giro on the PDF @375px', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    await ensureTenantCompany(page);
  });

  test('saves the tagline in Datos and prints it under the name on the PDF', async ({
    page,
  }) => {
    // Any document works: the header is the same on presupuestos and recibos.
    // No networkidle: the realtime SSE stream keeps the network busy.
    const firstDocument = async (path: '/presupuestos' | '/tickets') => {
      await page.goto(path);
      const documentLinks = async () =>
        (
          await page
            .locator(`a[href^="${path}/"]`)
            .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
        )
          .map((href) => href.match(/^\/(presupuestos|tickets)\/(\d+)$/))
          .filter((match): match is RegExpMatchArray => Boolean(match));
      const found = await expect
        .poll(async () => (await documentLinks()).length, { timeout: 15_000 })
        .toBeGreaterThan(0)
        .then(() => true)
        .catch(() => false);
      const match = found ? (await documentLinks())[0] : null;
      return match ? { kind: match[1], id: match[2] } : null;
    };
    const document = (await firstDocument('/presupuestos')) ?? (await firstDocument('/tickets'));
    test.skip(!document, 'No presupuestos or tickets for this tenant yet');
    const { kind, id } = document!;

    const previous = await (await openConfiguracion(page)).inputValue();
    const tagline = `Giro e2e ${Date.now() % 100_000}`;
    try {
      await saveTagline(page, tagline);
      await expect(page.getByTestId('company-tagline-counter').locator('visible=true').first()).toHaveText(
        `${tagline.length}/60`,
      );

      const response = await page.request.get(`/api/tickets/${id}/invoice`);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('application/pdf');
      const [first] = extractPdfText(await response.body());
      expect(first.width).toBeCloseTo(612, 0);
      const text = pageText(first);
      expect(text).toContain(tagline);
      expect(text).not.toMatch(/IVA|CFDI/);
      // The tagline sits right under the company name, before the title.
      const title = text.indexOf(kind === 'presupuestos' ? 'PRESUPUESTO' : 'RECIBO');
      expect(title).toBeGreaterThan(text.indexOf(tagline));
    } finally {
      await saveTagline(page, previous);
    }
  });
});
