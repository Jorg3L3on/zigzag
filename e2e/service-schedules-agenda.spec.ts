import { test, expect, type Locator, type Page } from '@playwright/test';
import { addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Pool } from 'pg';
import { DEMO_COMPANY_NAME } from '../src/lib/demo-company';
import { expectNoSeriousViolations } from './helpers/a11y';
import { e2eCredentialsSkipReason, ensureTenantCompany, hasE2eCredentials, login } from './helpers/auth';

/**
 * ZIG-I30: service schedules as an agenda at 1280 px. The spec seeds its own
 * clients, service, schedules and one finished ticket in the e2e company and
 * narrows the agenda to them with the search, so the counts are exact. Saves
 * data: scratch DB or CI, never Neon.
 */

const companyName = process.env.E2E_COMPANY_NAME ?? DEMO_COMPANY_NAME;
const suffix = `${Date.now()}`.slice(-7);
const prefix = `Agenda e2e ${suffix}`;

type Fixtures = {
  serviceId: number;
  clients: Record<'A' | 'B' | 'C' | 'D' | 'E', number>;
  schedules: Record<'A' | 'B' | 'C' | 'D', number>;
  ticketId: string;
  folio: string;
};

let fixtures: Fixtures;

const openPool = () => {
  const url = process.env.DATABASE_URL ?? '';
  if (new URL(url).hostname.endsWith('.neon.tech')) {
    throw new Error('service-schedules-agenda saves data; point DATABASE_URL at a local database');
  }
  return new Pool({ connectionString: url });
};

/** Noon UTC of the company day `days` from today, as stored timestamps read it. */
const dueSql = (days: number) =>
  `date_trunc('day', now() at time zone 'America/Mexico_City') + interval '${days} days' + interval '12 hours'`;

const seed = async (): Promise<Fixtures> => {
  const pool = openPool();
  try {
    const { rows: companies } = await pool.query<{ id: number }>(
      `SELECT id FROM "Company" WHERE name = $1 AND deleted_at IS NULL LIMIT 1`,
      [companyName],
    );
    const companyId = companies[0].id;
    const { rows: services } = await pool.query<{ id: number }>(
      `INSERT INTO "Service" (name, description, price, company_id)
       VALUES ($1, 'e2e agenda', 900, $2) RETURNING id`,
      [`Mantenimiento ${suffix}`, companyId],
    );
    const serviceId = services[0].id;

    const clients = {} as Fixtures['clients'];
    for (const [index, key] of (['A', 'B', 'C', 'D', 'E'] as const).entries()) {
      const { rows } = await pool.query<{ id: number }>(
        `INSERT INTO "Client" (name, phone, city, company_id) VALUES ($1, $2, 'Monterrey', $3) RETURNING id`,
        [`${prefix} ${key}`, `551${suffix}${index}`, companyId],
      );
      clients[key] = rows[0].id;
    }

    const schedules = {} as Fixtures['schedules'];
    const dueDays: Record<keyof Fixtures['schedules'], number> = { A: -20, B: 40, C: -5, D: -3 };
    for (const key of ['A', 'B', 'C', 'D'] as const) {
      const { rows } = await pool.query<{ id: number }>(
        `INSERT INTO "ClientServiceSchedule"
           (company_id, client_id, service_id, interval_value, interval_unit, last_service_at, next_due_at, created_at)
         VALUES ($1, $2, $3, 6, 'month', ${dueSql(dueDays[key] - 182)}, ${dueSql(dueDays[key])}, now() at time zone 'UTC')
         RETURNING id`,
        [companyId, clients[key], serviceId],
      );
      schedules[key] = rows[0].id;
    }

    // A finished ticket of A with the service, touched today: the panel shows it as the
    // ticket that created the schedule. Its folio comes after the company's last one.
    const { rows: folios } = await pool.query<{ next: number; prefix: string }>(
      `SELECT GREATEST(
          COALESCE((SELECT last_number FROM "DocumentFolioCounter" WHERE company_id = $1 AND document_kind = 'ticket'), 0),
          COALESCE((SELECT max(folio_number) FROM "Ticket" WHERE company_id = $1 AND document_kind = 'ticket'), 0)
        ) + 1 AS next,
        COALESCE((SELECT folio_prefix FROM "Ticket" WHERE company_id = $1 AND document_kind = 'ticket'
                  AND folio_prefix IS NOT NULL ORDER BY folio_number DESC NULLS LAST LIMIT 1), 'R') AS prefix`,
      [companyId],
    );
    const { next, prefix: folioPrefix } = folios[0];
    await pool.query(
      `INSERT INTO "DocumentFolioCounter" (company_id, document_kind, last_number) VALUES ($1, 'ticket', $2)
       ON CONFLICT (company_id, document_kind) DO UPDATE SET last_number = EXCLUDED.last_number`,
      [companyId, next],
    );
    const { rows: tickets } = await pool.query<{ id: string }>(
      `INSERT INTO "Ticket" (company_id, client_id, client_name, client_tel, ticket_date, total, paid, finished,
                             document_kind, folio_prefix, folio_number, updated_at)
       VALUES ($1, $2, $3, $4, now() at time zone 'UTC', 900, 900, true, 'ticket', $5, $6, now() at time zone 'UTC')
       RETURNING id::text`,
      [companyId, clients.A, `${prefix} A`, `551${suffix}0`, folioPrefix, next],
    );
    await pool.query(
      `INSERT INTO "ServicesTickets" (service_id, ticket_id, quantity, price) VALUES ($1, $2, 1, 900)`,
      [serviceId, tickets[0].id],
    );

    return {
      serviceId,
      clients,
      schedules,
      ticketId: tickets[0].id,
      folio: `${folioPrefix}-${String(next).padStart(4, '0')}`,
    };
  } finally {
    await pool.end();
  }
};

const cleanup = async () => {
  if (!fixtures) return;
  const pool = openPool();
  try {
    const clientIds = Object.values(fixtures.clients);
    await pool.query(`DELETE FROM "ClientServiceSchedule" WHERE client_id = ANY($1::int[])`, [clientIds]);
    await pool.query(`DELETE FROM "ServicesTickets" WHERE ticket_id IN (SELECT id FROM "Ticket" WHERE client_id = ANY($1::int[]))`, [clientIds]);
    await pool.query(`DELETE FROM "Ticket" WHERE client_id = ANY($1::int[])`, [clientIds]);
    await pool.query(`DELETE FROM "Client" WHERE id = ANY($1::int[])`, [clientIds]);
    await pool.query(`DELETE FROM "Service" WHERE id = $1`, [fixtures.serviceId]);
  } finally {
    await pool.end();
  }
};

const row = (page: Page, key: keyof Fixtures['schedules'] | number): Locator =>
  page.locator(
    `[data-testid="service-schedule-row"][data-schedule-id="${typeof key === 'number' ? key : fixtures.schedules[key]}"]`,
  );

const tabCount = (page: Page, view: string) => page.getByTestId(`schedule-tab-count-${view}`);

const openAgenda = async (page: Page, query = '') => {
  await page.goto(`/service-schedules${query}`);
  await ensureTenantCompany(page);
  await expect(page.getByTestId('service-schedules-agenda')).toBeVisible({ timeout: 30_000 });
  const search = page.getByLabel('Buscar recordatorios por cliente o servicio');
  // A fill right after goto can be wiped by hydration; retry until the counts follow it.
  await expect(async () => {
    await search.fill(prefix);
    await expect(tabCount(page, 'todos')).toHaveText(/^[0-9]$/, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
};

test.describe('Recordatorios agenda @1280px (ZIG-I30)', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 1280, height: 900 } });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    fixtures = await seed();
  });

  test.afterAll(async () => {
    await cleanup();
  });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await login(page);
  });

  test('Por atender by default with counts, relative dates, hover Crear ticket, ⋮ by keyboard, bulk Posponer with Deshacer', async ({ page }) => {
    await openAgenda(page);
    await expect(page.getByRole('button', { name: /^Por atender/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(tabCount(page, 'por-atender')).toHaveText('3');
    await expect(tabCount(page, 'programados')).toHaveText('1');
    await expect(tabCount(page, 'pausados')).toHaveText('0');
    await expect(tabCount(page, 'todos')).toHaveText('4');
    await expect(page.getByTestId('service-schedules-range')).toHaveText('1–3 de 3');

    const overdue = row(page, 'A').getByText('hace 20 días');
    await expect(overdue).toBeVisible();
    await expect(overdue).toHaveClass(/text-destructive/);
    await expect(row(page, 'A').getByText('Atrasado')).toBeVisible();

    await page.getByRole('button', { name: /^Programados/ }).click();
    await expect(page).toHaveURL(/vista=programados/);
    await expect(row(page, 'B').getByText('en 40 días')).toBeVisible();
    await expect(row(page, 'B').getByText('Programado')).toBeVisible();
    await page.getByRole('button', { name: /^Por atender/ }).click();
    await expect(row(page, 'A')).toBeVisible();

    // ⋮ is a real button: focus it and open it with the keyboard.
    const menuTrigger = row(page, 'A').getByRole('button', { name: /^Acciones del recordatorio/ });
    await menuTrigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Marcar como hecho' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Eliminar' })).toBeVisible();
    await page.keyboard.press('Escape');

    // Two rows, Posponer 14 días: they leave Por atender, Deshacer brings them back.
    await row(page, 'C').getByRole('checkbox').click();
    await row(page, 'D').getByRole('checkbox').click();
    const bar = page.getByTestId('service-schedules-selection-bar');
    await expect(bar).toContainText('2 seleccionados');
    await bar.getByRole('button', { name: 'Posponer' }).click();
    await page.getByRole('menuitem', { name: '14 días' }).click();
    await expect(tabCount(page, 'por-atender')).toHaveText('1');
    await expect(tabCount(page, 'programados')).toHaveText('3');
    await page.getByRole('button', { name: 'Deshacer' }).click();
    await expect(tabCount(page, 'por-atender')).toHaveText('3');
    await expect(row(page, 'C').getByText('hace 5 días')).toBeVisible();

    // Hover shows Crear ticket, which opens the composer with the client and the service.
    await row(page, 'A').hover();
    const createTicket = row(page, 'A').getByRole('link', { name: /^Crear ticket para/ });
    await expect(createTicket).toBeVisible();
    await createTicket.click();
    await expect(page).toHaveURL(
      new RegExp(`/tickets/create\\?clientId=${fixtures.clients.A}&serviceId=${fixtures.serviceId}`),
    );
  });

  test('the old ?filter=atrasados link narrows Por atender', async ({ page }) => {
    await openAgenda(page, '?filter=atrasados');
    await expect(page.getByRole('button', { name: /^Por atender/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^Atrasados/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('service-schedules-range')).toHaveText('1–3 de 3');
  });

  test('panel with the service history, Posponer 30 días, Marcar como hecho and Nuevo recordatorio', async ({ page }) => {
    await openAgenda(page);

    await row(page, 'A').getByText(`Mantenimiento ${suffix}`).click();
    const panel = page.getByTestId('schedule-side-panel');
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`ver=${fixtures.schedules.A}`));
    await expect(panel.getByTestId('schedule-origin-ticket')).toHaveText(fixtures.folio);
    await expect(panel.getByTestId('schedule-service-history')).toContainText(fixtures.folio);
    await expect(panel.getByText(/^Historial de este servicio/)).toContainText('1');

    await panel.getByRole('button', { name: /^Acciones del recordatorio/ }).click();
    await page.getByRole('menuitem', { name: 'Posponer' }).click();
    await page.getByRole('menuitem', { name: /^30 días/ }).click();
    await expect(panel.getByText('en 30 días')).toBeVisible();
    await expect(tabCount(page, 'por-atender')).toHaveText('2');
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page).not.toHaveURL(/ver=/);

    // Marcar como hecho today: C moves to Programados.
    await row(page, 'C').getByRole('button', { name: /^Acciones del recordatorio/ }).click();
    await page.getByRole('menuitem', { name: 'Marcar como hecho' }).click();
    const doneDialog = page.getByTestId('schedule-mark-done-dialog');
    await expect(doneDialog.getByTestId('schedule-mark-done-preview')).toContainText('El próximo queda para el');
    await doneDialog.getByRole('button', { name: 'Marcar como hecho' }).click();
    await expect(tabCount(page, 'por-atender')).toHaveText('1');
    await page.getByRole('button', { name: /^Programados/ }).click();
    await expect(row(page, 'C').getByText('Programado')).toBeVisible();
    await expect(row(page, 'C').getByText('en 6 meses')).toBeVisible();

    // Nuevo recordatorio, cada 2 meses: the preview and the new row in Programados.
    await page.getByRole('button', { name: 'Nuevo recordatorio' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nuevo recordatorio' });
    await dialog.getByRole('combobox', { name: 'Cliente' }).click();
    await page.getByPlaceholder('Nombre del cliente').fill(`${prefix} E`);
    await page.getByRole('option', { name: `${prefix} E` }).click();
    await dialog.getByRole('combobox', { name: 'Servicio' }).click();
    await page.getByRole('option', { name: `Mantenimiento ${suffix}` }).click();
    await dialog.getByRole('button', { name: '2 meses' }).click();
    const expected = format(addMonths(new Date(), 2), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
    await expect(dialog.getByTestId('schedule-form-preview')).toHaveText(`Próximo recordatorio: ${expected}`);
    await dialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(dialog).toBeHidden();
    await expect(tabCount(page, 'programados')).toHaveText('4');
    await expect(
      page.getByTestId('service-schedule-row').filter({ hasText: `${prefix} E` }).getByText('cada 2 meses'),
    ).toBeVisible();
  });

  test('agenda and panel pass axe; the panel takes focus and Escape closes it', async ({ page }) => {
    await openAgenda(page);
    await expectNoSeriousViolations(page, 'agenda Por atender');
    await page.getByRole('button', { name: /^Todos/ }).first().click();
    await expect(page).toHaveURL(/vista=todos/);
    await expectNoSeriousViolations(page, 'agenda Todos');

    await row(page, 'B').getByRole('button', { name: `${prefix} B` }).click();
    const panel = page.getByTestId('schedule-side-panel');
    await expect(panel).toBeVisible();
    await expect
      .poll(() => panel.evaluate((node) => node.contains(document.activeElement)))
      .toBe(true);
    await expectNoSeriousViolations(page, 'agenda panel');
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });
});
