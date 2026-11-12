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
  saveAndFinishComposer,
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

    // Read only: picks the client of the newest card, saves nothing (ZIG-I37-1).
    test('Más filtros: searchable Cliente, its chip and the Por cobrar count follow it', async ({ page }) => {
      await page.goto('/tickets');
      const cards = page.getByRole('button', { name: /^(Ver|Editar) ticket \d+$/ }).filter({ visible: true });
      await expect(cards.first()).toBeVisible({ timeout: 30_000 });
      const name = (await cards.first().getByTestId('ticket-card-name').innerText()).trim();
      const dueChip = page.getByRole('group', { name: 'Filtro de cobro' }).getByRole('button', { name: /^Por cobrar/ });
      const dueOf = async () => Number(/· (\d+)/.exec(await dueChip.innerText())?.[1] ?? 0);
      const dueBefore = await dueOf();

      const more = page.getByTestId('list-mobile-controls').getByRole('button', { name: /^Más filtros/ });
      await more.click();
      const sheet = page.getByRole('dialog');
      await expect(sheet.getByText('Cliente, trabajo, fechas y orden')).toBeVisible();
      const select = sheet.getByRole('combobox', { name: 'Filtrar por cliente' });
      await expect(select).toHaveText(/Todos los clientes/);
      const box = await select.boundingBox();
      expect(box!.height, 'touch height').toBeGreaterThanOrEqual(44);
      await select.click();
      const searchBox = page.getByRole('combobox', { name: 'Buscar cliente…' });
      await expect(searchBox).toBeFocused();
      await searchBox.fill(name);
      const option = page.getByRole('option').filter({ hasText: name }).first();
      await expect(option).toBeVisible({ timeout: 15_000 });
      // The open list stays inside what the person sees.
      const vv = await page.evaluate(() => ({
        w: window.visualViewport?.width ?? window.innerWidth,
        h: window.visualViewport?.height ?? window.innerHeight,
      }));
      const optionBox = (await option.boundingBox())!;
      expect(optionBox.x).toBeGreaterThanOrEqual(0);
      expect(optionBox.x + optionBox.width).toBeLessThanOrEqual(vv.w + 1);
      expect(optionBox.y + optionBox.height).toBeLessThanOrEqual(vv.h + 1);
      await expectNoPageOverflow(page, 'sheet with the client list open');
      await option.getByRole('button').click();

      await expect(page).toHaveURL(/[?&]cliente=\d+/);
      await expect(select).toContainText(name);
      await sheet.getByRole('button', { name: 'Listo' }).click();
      await expect(sheet).toBeHidden();
      // The sheet counter counts it (the trigger is hidden from the tree while the sheet is open).
      await expect(more).toHaveAccessibleName(/Más filtros \(1 activos\)/);

      const chip = page.getByRole('button', { name: `Quitar filtro Cliente: ${name}` });
      await expect(chip).toBeVisible({ timeout: 15_000 });
      await expect(chip).toContainText(`Cliente: ${name}`);
      // A tap target like the rest of the phone controls: at least 44px tall.
      expect((await chip.boundingBox())!.height, 'chip touch height').toBeGreaterThanOrEqual(44);
      await expect(cards.first()).toBeVisible({ timeout: 15_000 });
      const names = await cards.evaluateAll((els) =>
        els.map((el) => el.querySelector('[data-testid="ticket-card-name"]')?.textContent?.trim() ?? ''),
      );
      expect(new Set(names), 'only that client').toEqual(new Set([name]));
      await expect.poll(dueOf, { timeout: 15_000 }).toBeLessThanOrEqual(dueBefore);
      await expectNoPageOverflow(page, 'filtered list');

      // The chip's × drops it.
      await chip.click();
      await expect(page).not.toHaveURL(/[?&]cliente=/);
      await expect(chip).toHaveCount(0);
      await expect.poll(dueOf, { timeout: 15_000 }).toBe(dueBefore);

      // So does Limpiar todos los filtros in the sheet.
      await more.click();
      await sheet.getByRole('combobox', { name: 'Filtrar por cliente' }).click();
      await page.getByRole('combobox', { name: 'Buscar cliente…' }).fill(name);
      await page.getByRole('option').filter({ hasText: name }).first().getByRole('button').click();
      await expect(page).toHaveURL(/[?&]cliente=\d+/);
      await sheet.getByRole('button', { name: 'Limpiar todos los filtros activos' }).click();
      await expect(page).not.toHaveURL(/[?&]cliente=/);
      await expect(sheet.getByRole('combobox', { name: 'Filtrar por cliente' })).toHaveText(/Todos los clientes/);
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
        const id = paid
          ? (await saveAndFinishComposer(page, { mode: 'partial', amount: 500000 }, { send: false })).ticketId
          : await saveComposer(page);
        ids.push(id);
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

      // No Por cobrar total above the list in any width (ZIG-I27-3); the chip keeps its count.
      await expect(page.getByTestId('tickets-balance-due')).toHaveCount(0);

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
      await expect(partialCard.getByTestId('ticket-payment-summary')).toContainText('Faltan $800,488.89');
      // Unpaid fixtures are still unfinished: En proceso with the Total (ZIG-I36-17).
      const openCard = cards.filter({ hasText: 'En proceso' }).first();
      await expect(openCard.getByTestId('ticket-payment-summary')).toContainText('Total');
      await expect(openCard.getByTestId('ticket-payment-summary')).toContainText('$1,300,488.89');
      await expectNoPageOverflow(page, 'tickets list');

      // Cards now carry the work line and 14 px text (ZIG-I18-5/8): the first heavy card
      // fits whole above the dock and the second shows its top, so the list reads as scrollable.
      const heights = await Promise.all([0, 1].map(async (i) => (await cards.nth(i).boundingBox())!.height));
      expect(heights[0], `first heavy card (${heights[0]}px) fits the ${Math.round(room)}px above the dock`).toBeLessThanOrEqual(room);
      expect(heights[0] + 10, 'the second card starts above the dock').toBeLessThan(room);

      // Check 4: chips drive the status filter and the search keeps its value and element.
      const group = page.getByRole('group', { name: 'Filtro de cobro' });
      await expect(group.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
      await group.getByRole('button', { name: /^Por cobrar/ }).click();
      await expect(page).toHaveURL(/status=due/);
      await expect(group.getByRole('button', { name: /^Por cobrar/ })).toHaveAttribute('aria-pressed', 'true');
      await expect(group.getByRole('button', { name: /^Por cobrar · 1$/ })).toBeVisible({ timeout: 15_000 });
      // Por cobrar is finished work with a saldo: only the half-paid ticket (ZIG-I36-17).
      await expect(cards).toHaveCount(1);
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
