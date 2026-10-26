import { test, expect, type Page } from '@playwright/test';
import { Pool } from 'pg';
import { e2eCredentialsSkipReason, ensureTenantCompany, hasE2eCredentials, login } from './helpers/auth';
import { expectNoSeriousViolations } from './helpers/a11y';
import { addCustomComposerLine, createClientInComposer } from './helpers/ticket-composer';

/**
 * ZIG-I29 at 1280px: the presupuesto detail in its four states (Vigencia y
 * aceptación, Vencido, Aceptado, Cancelado), Extender vigencia, and the table
 * with views, server counts, Vence tones and hover Convertir. Saves data and
 * moves one expiry into the past with SQL: scratch database or CI only.
 */

const DAY_MS = 86_400_000;

const createPresupuesto = async (
  page: Page,
  { clientName, phone, lines }: { clientName: string; phone: string; lines: Array<{ name: string; price: string; materials?: number }> },
) => {
  await page.goto('/presupuestos/create');
  await expect(page.getByRole('heading', { name: 'Cliente', exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await createClientInComposer(page, { name: clientName, phone });
  for (const line of lines) {
    await addCustomComposerLine(page, { name: line.name, quantity: '1', price: line.price, materials: line.materials });
  }
  await page.getByRole('button', { name: '15 días' }).click();
  const save = page.getByRole('button', { name: /^Guardar( presupuesto)?$/ }).first();
  await expect(save).toBeEnabled();
  await save.click();
  await page.waitForURL(/\/presupuestos\/\d+$/, { timeout: 60_000 });
  const id = page.url().match(/\/presupuestos\/(\d+)$/)?.[1];
  expect(id).toBeTruthy();
  await expect(page.getByTestId('presupuesto-desktop')).toBeVisible({ timeout: 15_000 });
  return id as string;
};

/** The phone tree renders first on load; read the desktop one. */
const desktopStatus = (page: Page) =>
  page.getByTestId('presupuesto-desktop').getByTestId('presupuesto-status');

const folioOf = async (page: Page) => {
  const text = (await page.getByTestId('presupuesto-header').getByText(/^Presupuesto /).textContent()) ?? '';
  return text.replace('Presupuesto ', '').trim();
};

const extendBy = async (page: Page, days: 7 | 15 | 30) => {
  await page
    .getByTestId('presupuesto-vigencia-card')
    .getByRole('button', { name: 'Extender vigencia' })
    .click();
  const dialog = page.getByTestId('presupuesto-extend-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: `+${days} días` }).click();
  await expect(dialog.getByTestId('presupuesto-extend-preview')).toContainText('Nueva vigencia:');
  await dialog.getByRole('button', { name: 'Extender vigencia' }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
};

test.describe('Presupuestos desktop at 1280 and 1024 (ZIG-I29)', () => {
  // The composer and the vigencia copy count days in the browser's zone; the
  // company works in Mexico City, and so does every expiry stored here.
  test.use({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Mexico_City' });
  test.setTimeout(480_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    test.skip(!process.env.DATABASE_URL, 'Needs DATABASE_URL to move an expiry into the past');
    await login(page);
    await ensureTenantCompany(page);
  });

  test('open → extended → expired → extended → accepted from the list; canceled read-only', async ({
    page,
  }) => {
    const suffix = `${Date.now()}`.slice(-8);
    const clientName = `Cliente presupuesto ${suffix}`;
    const id = await createPresupuesto(page, {
      clientName,
      phone: `984${suffix.slice(-7)}`,
      lines: [
        { name: 'Instalación mini-split', price: '4200', materials: 1 },
        { name: 'Diagnóstico técnico', price: '320' },
      ],
    });
    const folio = await folioOf(page);

    // Abierto: chip, meta, bar, Convertir twice, Recordar por WhatsApp.
    await expect(desktopStatus(page)).toHaveText('Abierto');
    await expect(page.getByTestId('presupuesto-vigencia-chip')).toHaveText('Vence en 15 días');
    await expect(page.getByTestId('presupuesto-meta')).toContainText('2 conceptos · 1 material');
    const card = page.getByTestId('presupuesto-vigencia-card');
    await expect(card.getByTestId('presupuesto-vigencia-bar')).toBeVisible();
    await expect(card.getByText('Vigencia de 15 días')).toBeVisible();
    const actions = page.getByTestId('presupuesto-desktop-actions');
    await expect(actions.getByRole('button', { name: 'Convertir a ticket' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Convertir a ticket' })).toBeVisible();
    await expect(card.getByRole('link', { name: 'Recordar por WhatsApp' })).toHaveAttribute(
      'href',
      /^https:\/\/wa\.me\/\d+\?text=/,
    );
    await expect(page.getByTestId('presupuesto-client-documents')).toContainText('1 presupuesto');
    const telLinks = await page.locator('a[href^="tel:"]').count();
    expect(telLinks).toBe(0);
    await expectNoSeriousViolations(page, 'presupuesto-abierto');

    // Extender +7 from the current expiry.
    await extendBy(page, 7);
    await expect(page.getByTestId('presupuesto-vigencia-chip')).toHaveText('Vence en 22 días', {
      timeout: 15_000,
    });

    // Vencido: issued 20 days ago, expired 3 days ago (Mexico City midnight).
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      // The column is a UTC wall clock (timestamp without time zone, written by
      // drizzle as UTC); pg would send a Date with the local offset, so pass text.
      const midnight = (offsetDays: number) => {
        const day = new Date(Date.now() - 6 * 3_600_000 + offsetDays * DAY_MS);
        return `${day.toISOString().slice(0, 10)} 06:00:00`;
      };
      await pool.query(
        `UPDATE "Ticket" SET ticket_date = $2, expires_at = $3 WHERE id = $1 AND document_kind = 'presupuesto'`,
        [id, midnight(-20), midnight(-3)],
      );
    } finally {
      await pool.end();
    }
    await page.reload();
    await expect(desktopStatus(page)).toHaveText('Vencido', { timeout: 15_000 });
    const chip = page.getByTestId('presupuesto-vigencia-chip');
    await expect(chip).toHaveText('Venció hace 3 días');
    await expect(chip).toHaveAttribute('data-tone', 'expired');
    await expect(page.getByTestId('presupuesto-desktop-expires')).toHaveAttribute('data-tone', 'expired');
    await expect(actions.getByRole('button', { name: 'Convertir a ticket' })).toBeVisible();
    await expect(actions.getByRole('link', { name: 'Editar' })).toBeVisible();
    await expectNoSeriousViolations(page, 'presupuesto-vencido');

    // Extender +7 from today brings it back to Abierto.
    await extendBy(page, 7);
    await expect(desktopStatus(page)).toHaveText('Abierto', { timeout: 15_000 });
    await expect(chip).toHaveText('Vence en 7 días');
    await expect(page.getByTestId('presupuesto-activity-card')).toContainText('extendió la vigencia');

    // The table: default Abiertos + Vencidos, counts, the row with «en 7 días», Convertir on hover.
    await page.goto('/presupuestos');
    const tabs = page.getByRole('navigation', { name: 'Vistas de presupuestos' });
    await expect(tabs).toBeVisible({ timeout: 15_000 });
    await expect(tabs.getByRole('button', { name: /Abiertos/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(tabs.getByRole('button', { name: /Vencidos/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(tabs).not.toContainText('$');
    await page.getByRole('textbox', { name: /Buscar presupuestos/ }).fill(clientName);
    const row = page.getByTestId('presupuesto-table-row').filter({ hasText: folio });
    await expect(row).toHaveCount(1, { timeout: 15_000 });
    await expect(row.getByTestId('presupuesto-vence')).toContainText('en 7 días');
    await expect(row.getByTestId('presupuesto-vence')).toHaveAttribute('data-tone', 'ok');
    await expect(page.getByText(/^1–1 de 1 presupuestos$/)).toBeVisible();
    await expect(tabs.getByRole('button', { name: /Todos/ })).toContainText('1');
    await expectNoSeriousViolations(page, 'presupuestos-lista');

    // ⋮ is reachable with the keyboard.
    const more = row.getByRole('button', { name: `Más acciones de ${folio}` });
    await more.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Extender vigencia' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();

    await row.hover();
    await row.getByRole('button', { name: `Convertir ${folio} a ticket` }).click();
    const confirm = page.getByRole('dialog').filter({ hasText: `¿Convertir el presupuesto ${folio} en ticket?` });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Convertir a ticket' }).click();
    await page.waitForURL(/\/tickets\/\d+$/, { timeout: 60_000 });
    const ticketId = page.url().match(/\/tickets\/(\d+)$/)?.[1];

    // Aceptado: green pill, the R ticket card with its state and total, no Editar or Cancelar.
    await page.goto(`/presupuestos/${id}`);
    await expect(desktopStatus(page)).toHaveText('Aceptado', { timeout: 15_000 });
    await expect(desktopStatus(page)).toHaveClass(/emerald/);
    const accepted = page.getByTestId('presupuesto-accepted-card');
    const ticketCard = accepted.getByTestId('presupuesto-converted-ticket');
    await expect(ticketCard).toHaveAttribute('href', `/tickets/${ticketId}`);
    await expect(ticketCard).toContainText(/R-\d{4}/);
    await expect(ticketCard.getByTestId('ticket-status-pill')).toHaveText('En proceso');
    await expect(ticketCard.getByTestId('presupuesto-converted-total')).toHaveText('$4,771.00');
    await expect(actions.getByRole('link', { name: /^Ver ticket R-/ })).toBeVisible();
    await expect(actions.getByRole('link', { name: 'Editar' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Más acciones del presupuesto' }).click();
    await expect(page.getByRole('menuitem', { name: 'Cancelar presupuesto' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    // Actividad: real events with actor and time.
    const activity = page.getByTestId('presupuesto-activity-card');
    await expect(activity).toContainText('lo convirtió en ticket');
    await expect(activity).toContainText('creó el presupuesto');
    await expectNoSeriousViolations(page, 'presupuesto-aceptado');

    // Cancelado from the header menu, behind the destructive ConfirmSheet.
    const otherId = await createPresupuesto(page, {
      clientName: `${clientName} B`,
      phone: `985${suffix.slice(-7)}`,
      lines: [{ name: 'Mantenimiento preventivo', price: '916' }],
    });
    await page.getByRole('button', { name: 'Más acciones del presupuesto' }).click();
    await page.getByRole('menuitem', { name: 'Cancelar presupuesto' }).click();
    const cancel = page.getByRole('dialog').filter({ hasText: /¿Cancelar el presupuesto/ });
    await cancel.getByRole('button', { name: 'Cancelar presupuesto' }).click();
    await expect(page.getByTestId('presupuesto-canceled-card')).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(new RegExp(`/presupuestos/${otherId}$`));
    await expect(desktopStatus(page)).toHaveText('Cancelado');
    await expect(actions.getByRole('button', { name: 'Duplicar' })).toBeVisible();
    await expect(actions.getByRole('link', { name: 'Editar' })).toHaveCount(0);
    await expect(actions.getByRole('link', { name: 'WhatsApp' })).toHaveCount(0);
    await expect(page.getByTestId('presupuesto-activity-card')).toContainText('canceló el presupuesto');
    await expectNoSeriousViolations(page, 'presupuesto-cancelado');
  });

  test('at 1024 with the sidebar open, Concepto and Cliente keep room and ⋮ stays on screen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/presupuestos?estado=todos');
    const row = page.getByTestId('presupuesto-table-row').first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    const cliente = await row.locator('td').nth(1).boundingBox();
    expect(cliente?.width ?? 0).toBeGreaterThan(150);
    const more = await row.getByRole('button', { name: /^Más acciones de / }).boundingBox();
    expect((more?.x ?? 9999) + (more?.width ?? 0)).toBeLessThanOrEqual(1024);
    await expectNoSeriousViolations(page, 'presupuestos-lista-1024');

    await row.click();
    await page.waitForURL(/\/presupuestos\/\d+$/, { timeout: 15_000 });
    const line = page.getByTestId('presupuesto-desktop').getByTestId('document-line-row').first();
    await expect(line).toBeVisible({ timeout: 15_000 });
    const concepto = await line.locator('> div').first().boundingBox();
    expect(concepto?.width ?? 0).toBeGreaterThan(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
