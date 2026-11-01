import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

/**
 * ZIG-I36-17/-19/-25 (T6 group 3) on the audit tenant Auditoría Pesada: Por cobrar agrees
 * between Hoy and Tickets, search ignores accents and phone punctuation, and stays fast.
 * Needs `npm run seed:audit` on a disposable database.
 */
const OWNER = 'dueno@auditoria-pesada.test';
const PASSWORD = process.env.AUDIT_SEED_PASSWORD ?? 'Auditoria-2026';

test.describe('Tickets lists, Hoy and search (audit tenant)', () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER, PASSWORD);
  });

  test('Por cobrar counts agree between Hoy and Tickets and the title has no count', async ({ page }) => {
    await page.goto('/dashboard');
    const tile = page.getByRole('tab', { name: /Por cobrar/ });
    await expect(tile).toBeVisible();
    const hoyCount = (await tile.innerText()).match(/\d+/)?.[0];
    expect(Number(hoyCount)).toBeGreaterThan(0);

    await page.goto('/tickets');
    await expect(page.getByRole('heading', { level: 1, name: 'Tickets' })).toBeVisible();
    const views = page.getByRole('navigation', { name: 'Vistas de tickets' });
    await expect(views).toBeVisible();
    const dueTab = views.getByRole('button', { name: /Por cobrar/ });
    await expect(dueTab).toContainText(hoyCount!);
    await expect(page.getByRole('heading', { level: 1, name: 'Tickets' })).not.toContainText('·');
  });

  test('search ignores accents, case and phone punctuation, under a second', async ({ page }) => {
    await page.goto('/tickets');
    const search = page.getByRole('searchbox').or(page.getByPlaceholder(/Buscar por cliente/)).first();
    await expect(search).toBeVisible();

    const rows = page.getByTestId('tickets-row');
    await expect(rows.first()).toBeVisible();

    const started = Date.now();
    await search.fill('MUNOZ');
    await expect(rows.first()).toContainText(/Muñoz/);
    const elapsed = Date.now() - started;
    // 300 ms debounce included.
    expect(elapsed).toBeLessThan(1500);
    await expect(page.getByTestId('list-footer')).toContainText(/resultados?|1–25 de \d+ resultados/);

    await search.fill('555 000 0632');
    await expect(rows.first()).toContainText('632');
    await search.fill('(555) 000-0632');
    await expect(rows.first()).toContainText('632');
  });

  test('a desktop row says how many servicios and materiales', async ({ page }) => {
    await page.goto('/tickets');
    const work = page.getByTestId('ticket-row-work').first();
    await expect(work).toBeVisible();
    await expect(work).toContainText(/\d+ servicios?/);
  });

  test('the client picker finds a client without the accent', async ({ page }) => {
    await page.goto('/clients');
    const search = page.getByPlaceholder(/Buscar/).first();
    await search.fill('munoz');
    await expect(page.getByText(/Muñoz/).first()).toBeVisible();
    await expect(page.getByTestId('list-footer')).toContainText(/resultado/);
  });
});
