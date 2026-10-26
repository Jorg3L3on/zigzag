import { test, expect, type Page } from '@playwright/test';
import { e2eCredentialsSkipReason, ensureTenantCompany, hasE2eCredentials, login } from './helpers/auth';
import AxeBuilder from '@axe-core/playwright';
import { expectNoSeriousViolations } from './helpers/a11y';
import { waitForSettledLayout } from './helpers/layout';

/**
 * ZIG-I32 — Mi empresa at 1280: one header and a side nav, Datos as cards
 * with the receipt preview and the "Cambios sin guardar" bar, Equipo as a
 * table with real access states, Roles with switches.
 *
 * Read-only except the "Guardar persiste" test, which writes the tagline and
 * puts it back, so it only runs on a test database (CI=1).
 */
const writesAllowed = Boolean(process.env.CI);

const TAGLINE_LABEL = 'Lema o giro';

const openDatos = async (page: Page) => {
  await page.goto('/company');
  // Right after goto a streamed copy can sit hidden for a moment (ZIG-28).
  await waitForSettledLayout(page);
  await expect(page.getByTestId('company-datos-perfil')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.getByTestId('company-datos-perfil')).toBeVisible();
};

test.describe('Mi empresa desktop @1280px (ZIG-I32)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
    await ensureTenantCompany(page);
  });

  test('the hub shows one header with the readiness pill and the side nav', async ({ page }) => {
    await openDatos(page);
    const main = page.locator('main');

    await expect(page.getByTestId('company-hub-header')).toHaveCount(1);
    await expect(main.locator('h1')).toHaveCount(1);
    await expect(page.getByTestId('company-hub-header')).toBeVisible();
    await expect(page.getByTestId('company-readiness-pill')).toHaveText(
      /Lista para operar|Configuración pendiente/,
    );
    await expect(page.getByTestId('company-hub-tabs')).toBeHidden();
    const nav = page.getByTestId('company-hub-side-nav');
    await expect(nav).toBeVisible();
    for (const label of ['Perfil', 'Dirección', 'Documentos y folios', 'Pagos por transferencia', 'Inicio']) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible();
    }
    await expect(nav.getByRole('link', { name: /^Equipo/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /^Roles/ })).toBeVisible();
  });

  test('Datos shows the five anchored sections without Estado de la empresa', async ({ page }) => {
    await openDatos(page);

    for (const id of ['perfil', 'direccion', 'documentos', 'pagos', 'inicio']) {
      await expect(page.locator(`section#${id}`)).toBeVisible();
    }
    await expect(page.getByLabel('Estado de la empresa')).toHaveCount(0);
    await expect(page.getByTestId('company-next-folio-ticket')).toHaveText(/^[A-Z0-9]+-\d{4,}$/);

    await page.getByTestId('company-hub-side-nav').getByRole('link', { name: 'Inicio' }).click();
    await expect(page).toHaveURL(/#inicio$/);
    await expect(page.locator('section#inicio')).toBeInViewport();
  });

  test('typing a tagline updates the preview and the changes bar; Descartar restores', async ({ page }) => {
    await openDatos(page);
    const input = page.getByTestId('company-datos-perfil').getByLabel(TAGLINE_LABEL);
    const original = await input.inputValue();
    const preview = page.getByTestId('company-receipt-preview');

    await expect(page.getByTestId('form-changes-bar')).toHaveCount(0);
    await input.fill('Plomería y gas QA');
    await expect(preview.getByTestId('receipt-preview-tagline')).toHaveText('Plomería y gas QA');
    const bar = page.getByTestId('form-changes-bar');
    await expect(bar).toContainText('Cambios sin guardar');
    await expect(bar).toContainText(TAGLINE_LABEL);

    await bar.getByRole('button', { name: 'Descartar' }).click();
    await expect(page.getByTestId('form-changes-bar')).toHaveCount(0);
    await expect(input).toHaveValue(original);
  });

  test('the preview prints the company as the recibo does', async ({ page }) => {
    await openDatos(page);
    const perfil = page.getByTestId('company-datos-perfil');
    const name = await perfil.getByLabel('Nombre').inputValue();
    const email = await perfil.getByLabel('Correo electrónico').inputValue();
    const phone = await perfil.getByLabel('Teléfono').inputValue();

    const preview = page.getByTestId('company-receipt-preview');
    await expect(preview.getByTestId('receipt-preview-name')).toHaveText(name.trim());
    const footer = preview.getByTestId('receipt-preview-footer');
    await expect(footer).toContainText(email.trim());
    await expect(footer).toContainText(phone.trim());
  });

  test('Guardar persists the tagline and the bar goes away', async ({ page }) => {
    test.skip(!writesAllowed, 'Writes data: test database only (CI=1)');
    await openDatos(page);
    const input = page.getByTestId('company-datos-perfil').getByLabel(TAGLINE_LABEL);
    const original = await input.inputValue();
    const next = `QA ${Date.now()}`.slice(0, 60);

    await input.fill(next);
    await page.getByTestId('form-changes-bar').getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByTestId('form-changes-bar')).toHaveCount(0, { timeout: 15_000 });
    await page.reload();
    await expect(page.getByTestId('company-datos-perfil').getByLabel(TAGLINE_LABEL)).toHaveValue(next, {
      timeout: 15_000,
    });

    // Put it back.
    await page.getByTestId('company-datos-perfil').getByLabel(TAGLINE_LABEL).fill(original);
    await page.getByTestId('form-changes-bar').getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByTestId('form-changes-bar')).toHaveCount(0, { timeout: 15_000 });
  });

  test('Equipo is a Persona · Rol · Acceso · Alta table without «Sin verificar»', async ({ page }) => {
    await page.goto('/company/equipo');
    const desktop = page.getByTestId('team-desktop');
    await expect(desktop.getByTestId('team-member-row').first()).toBeVisible({ timeout: 15_000 });

    const headers = await desktop.getByRole('columnheader').allTextContents();
    expect(headers.join(' ')).toMatch(/Persona.*Rol.*Acceso.*Alta/);
    await expect(desktop.getByText('Sin verificar')).toHaveCount(0);
    await expect(desktop.getByTestId('team-member-access').filter({ visible: true }).first()).toHaveText(
      /Activo|Debe cambiar contraseña/,
    );
    await expect(desktop.getByRole('button', { name: 'Agregar persona' })).toBeVisible();
    await expect(desktop.getByRole('combobox', { name: 'Filtrar por acceso' })).toHaveText('Activos');
    // Hover actions stay inside the table (no sideways scroll).
    const row = desktop.getByTestId('team-member-row').first();
    await row.hover();
    await expect(row.getByRole('button', { name: /^Cambiar rol de / })).toBeVisible();
    const table = desktop.locator('table').locator('..');
    expect(await table.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  });

  test('at 1024 with the sidebar open Equipo and Roles fit without sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/company/equipo');
    const desktop = page.getByTestId('team-desktop');
    await expect(desktop.getByTestId('team-member-row').first()).toBeVisible({ timeout: 15_000 });
    const scroller = desktop.locator('table').locator('..');
    expect(await scroller.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    // Rol and Acceso sit under the name as pills at this width.
    await expect(desktop.getByTestId('team-member-access').filter({ visible: true }).first()).toBeVisible();

    await page.goto('/company/roles');
    await expect(page.getByTestId('role-list-item').first()).toBeVisible({ timeout: 15_000 });
    const matrix = page.getByRole('switch', { name: 'Editar Tickets' });
    const box = await matrix.boundingBox();
    const editor = await page.getByRole('region', { name: /Editar rol|Nuevo rol/ }).boundingBox();
    // The editor spans the hub column (cards above it), not a 216 px sliver.
    expect(editor?.width ?? 0).toBeGreaterThan(400);
    expect(box).toBeTruthy();
  });

  test('Roles marks the chosen role, uses switches and keeps Editar incluye Ver', async ({ page }) => {
    await page.goto('/company/roles');
    const items = page.getByTestId('role-list-item');
    await expect(items.first()).toBeVisible({ timeout: 15_000 });
    await expect(items.first()).toHaveAttribute('aria-pressed', 'true');

    await items.nth(1).click();
    await expect(items.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('checkbox', { name: /^Ver / })).toHaveCount(0);
    const editTeam = page.getByRole('switch', { name: 'Editar Equipo' });
    const readTeam = page.getByRole('switch', { name: 'Ver Equipo' });
    if ((await editTeam.getAttribute('aria-checked')) !== 'true') {
      await editTeam.click();
    }
    await expect(editTeam).toHaveAttribute('aria-checked', 'true');
    await expect(readTeam).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Cancelar' }).click();

    await page.getByRole('button', { name: 'Nuevo rol' }).click();
    await page.getByRole('group', { name: 'Plantillas' }).getByRole('button', { name: 'Técnico' }).click();
    await expect(page.getByRole('switch', { name: 'Editar Tickets' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: 'Técnico' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('axe finds no serious violations on Datos, Equipo with the panel open and Roles', async ({ page }) => {
    await openDatos(page);
    await expectNoSeriousViolations(page, 'company-datos-desktop');

    await page.goto('/company/equipo');
    await expect(page.getByTestId('team-member-row').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Agregar persona' }).click();
    await expect(page.getByTestId('team-member-panel')).toBeVisible();
    await expectNoSeriousViolations(page, 'company-equipo-panel-desktop');
    await page.keyboard.press('Escape');

    await page.goto('/company/roles');
    await expect(page.getByTestId('role-list-item').first()).toBeVisible({ timeout: 15_000 });
    await expectNoSeriousViolations(page, 'company-roles-desktop');
  });

  test('the hub content meets 4.5:1 contrast (color-contrast is off in the shared helper)', async ({ page }) => {
    const contrast = async (label: string) => {
      // Hover actions fade in; measure the resting page, not a half-faded row.
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);
      const results = await new AxeBuilder({ page })
        .withRules(['color-contrast'])
        .include('main')
        .analyze();
      const nodes = results.violations.flatMap((violation) =>
        violation.nodes.map((node) => `${node.target.join(' ')}: ${node.failureSummary ?? ''}`),
      );
      expect(nodes, `${label}: contrast`).toEqual([]);
    };

    await openDatos(page);
    // Show the changes bar too.
    await page.getByTestId('company-datos-perfil').getByLabel(TAGLINE_LABEL).fill('Contraste QA');
    await contrast('datos');
    await page.getByTestId('form-changes-bar').getByRole('button', { name: 'Descartar' }).click();

    await page.goto('/company/equipo');
    await expect(page.getByTestId('team-member-row').first()).toBeVisible({ timeout: 15_000 });
    await contrast('equipo');

    await page.goto('/company/roles');
    await expect(page.getByTestId('role-list-item').first()).toBeVisible({ timeout: 15_000 });
    await contrast('roles');
  });
});
