import { test, expect } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import {
  addCustomComposerLine,
  createClientInComposer,
  expectNoPageOverflow,
  finishOnReview,
  openComposer,
  saveComposer,
} from './helpers/ticket-composer';
import { MOBILE_WIDTHS } from './helpers/layout';

/**
 * ZIG-I13-7: the compact ticket cards of the canvas (TicketsList) with the heavy
 * fixtures: a 70-char client name and $1.3M tickets, one of them half paid.
 * Saves data: run it in CI or against a scratch database.
 */

for (const width of MOBILE_WIDTHS) {
  test.describe(`Tickets list redesign @${width}px`, () => {
    test.use({ viewport: { width, height: 812 } });
    test.setTimeout(300_000);

    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
      await ensureTenantCompany(page);
    });

    test('compact cards, Por cobrar header, chips and search', async ({ page }) => {
      const suffix = `${Date.now()}`.slice(-8);
      const clientName = `Corporativo Inmobiliario Torres del Caribe ${suffix} Torre B Piso 14 Zona Hotelera`;
      expect(clientName.length).toBeGreaterThanOrEqual(70);

      // Three heavy tickets for one long-named client; the middle one is half paid.
      const ids: string[] = [];
      for (const paid of [false, true, false]) {
        await openComposer(page);
        await page.evaluate(() => window.localStorage.clear());
        await page.reload();
        await createClientInComposer(page, {
          name: clientName,
          phone: `993${suffix.slice(-7)}`,
        }).catch(async () => {
          // The client exists after the first round: pick it from the list instead.
          await page.getByRole('combobox', { name: 'Cliente' }).click();
          await page.getByRole('option', { name: new RegExp(suffix) }).first().click();
        });
        await addCustomComposerLine(page, { name: 'Sustitución de sistema central', quantity: '1', price: '1300488.89' });
        const id = await saveComposer(page);
        ids.push(id);
        if (paid) await finishOnReview(page, id, { mode: 'partial', amount: 500000 });
      }

      await page.goto('/tickets');
      const search = page.getByPlaceholder('Cliente, número de ticket o teléfono');
      await expect(search).toBeVisible({ timeout: 15_000 });

      // Check 2: room for 3 heavy cards above the dock (375×812). The list opens on whatever is
      // newest, so measure the room first, then the heavy cards' own heights once filtered.
      const anyCard = page.getByRole('button', { name: /^(Ver|Editar) ticket \d+$/ }).filter({ visible: true });
      await expect(anyCard.first()).toBeVisible({ timeout: 15_000 });
      const dockTop = (await page.getByTestId('mobile-bottom-tab-bar').boundingBox())!.y;
      const room = dockTop - (await anyCard.first().boundingBox())!.y;

      await search.fill(suffix);
      await expect(page.getByText(`Búsqueda: ${suffix}`)).toBeVisible({ timeout: 15_000 });

      // Header: Por cobrar sums the saldos of the filter (3 tickets: 1,300,488.89 × 3 − 500,000).
      const header = page.getByTestId('tickets-balance-due').filter({ visible: true }).first();
      await expect(header).toContainText('$3,401,466.67');

      const cards = page.getByRole('button', { name: /^(Ver|Editar) ticket \d+$/ }).filter({ visible: true });
      await expect(cards).toHaveCount(3, { timeout: 15_000 });

      // Check 1: name in at most two lines; Pagado / Saldo / Total whole and unclipped.
      for (let i = 0; i < 3; i += 1) {
        const card = cards.nth(i);
        const name = card.getByTestId('ticket-card-name');
        const box = await name.boundingBox();
        expect(box!.height, 'name takes at most 2 lines').toBeLessThanOrEqual(2 * 21 + 2);
        const money = card.getByTestId('ticket-payment-summary');
        const clipped = await money.evaluate((el) =>
          [...el.querySelectorAll<HTMLElement>('span')].filter((s) => s.scrollWidth > s.clientWidth + 1).length,
        );
        expect(clipped, 'money never truncates').toBe(0);
      }
      const partialCard = cards.filter({ hasText: 'Pago parcial' }).first();
      await expect(partialCard.getByTestId('ticket-payment-summary')).toContainText('Pagado $500,000.00');
      await expect(partialCard.getByTestId('ticket-payment-summary')).toContainText('Saldo $800,488.89');
      const openCard = cards.filter({ hasText: 'Pendiente de pago' }).first();
      await expect(openCard.getByTestId('ticket-payment-summary')).toContainText('Total');
      await expect(openCard.getByTestId('ticket-payment-summary')).toContainText('$1,300,488.89');
      await expectNoPageOverflow(page, 'tickets list');

      // The three heavy cards, one under the other, fit the room above the dock.
      const heights = await Promise.all([0, 1, 2].map(async (i) => (await cards.nth(i).boundingBox())!.height));
      const wanted = width === 375 ? 3 : 2;
      const needed = heights.slice(0, wanted).reduce((sum, h) => sum + h, 0) + (wanted - 1) * 10;
      expect(needed, `${wanted} heavy cards (${needed}px) fit the ${Math.round(room)}px above the dock`).toBeLessThanOrEqual(room + 1);

      // Check 4: chips drive the status filter and the search keeps its value and element.
      const group = page.getByRole('group', { name: 'Filtro de cobro' });
      await expect(group.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
      await group.getByRole('button', { name: /^Por cobrar/ }).click();
      await expect(page).toHaveURL(/status=due/);
      await expect(group.getByRole('button', { name: /^Por cobrar/ })).toHaveAttribute('aria-pressed', 'true');
      await expect(group.getByRole('button', { name: /^Por cobrar · 3$/ })).toBeVisible({ timeout: 15_000 });
      await expect(cards).toHaveCount(3);
      await expect(search).toHaveValue(suffix);

      await group.getByRole('button', { name: 'Pagados' }).click();
      await expect(page).toHaveURL(/status=paid/);
      await expect(page.getByText('Sin resultados')).toBeVisible({ timeout: 15_000 });
      await expect(search).toHaveValue(suffix);

      await group.getByRole('button', { name: 'Todos' }).click();
      await expect(cards).toHaveCount(3, { timeout: 15_000 });
      expect(ids).toHaveLength(3);
    });
  });
}
