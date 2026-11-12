import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import { expectNoSeriousViolations } from './helpers/a11y';
import { DEMO_COMPANY_NAME } from '../src/lib/demo-company';

/**
 * Cobranza on desktop (ZIG-I31-2/3, list standard ZIG-I33-3) against ClimaTotal
 * Demo. The last test records a payment, so run it only against a disposable database.
 */
const money = (text: string | null): number => {
  const match = /\$\s?([\d,]+(?:\.\d{1,2})?)/.exec(text ?? '');
  return match ? Number(match[1].replace(/,/g, '')) : Number.NaN;
};

const stripAmount = async (page: Page, bucket: string): Promise<number> =>
  money(await page.getByTestId(`cobranza-bucket-${bucket}-amount`).textContent());

const waitForQueue = async (page: Page) => {
  await expect(page.getByTestId('cobranza-desktop')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('cobranza-row').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('cobranza-bucket-all-amount')).toContainText('$');
};

const days = async (rows: Locator): Promise<number[]> =>
  (await rows.getByTestId('cobranza-days').allTextContents()).map((text) =>
    Number.parseInt(text, 10),
  );

const balances = async (rows: Locator): Promise<number[]> =>
  (await rows.getByTestId('cobranza-balance').allTextContents()).map(money);

/** Nothing between the control and its row is transparent: shown without hover (85563215). */
const shownWithoutHover = (control: Locator): Promise<boolean> =>
  control.evaluate((element) => {
    for (let node: Element | null = element; node && node.tagName !== 'TR'; node = node.parentElement) {
      if (getComputedStyle(node).opacity === '0') return false;
    }
    return true;
  });

/** ListRowMenu opens WhatsApp with window.open; keep the URL instead of a new tab. */
const captureWindowOpen = (page: Page) =>
  page.evaluate(() => {
    const opened: string[] = [];
    (window as unknown as { __opened: string[] }).__opened = opened;
    window.open = ((url?: string | URL) => {
      opened.push(String(url));
      return null;
    }) as typeof window.open;
  });

const openedUrls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);

test.describe('Cobranza en escritorio (ZIG-I31, ZIG-I33-3)', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page);
    await ensureTenantCompany(page);
  });

  test('strip, folios, days from the work and the En proceso footnote', async ({ page }) => {
    await page.goto('/cobranza');
    await waitForQueue(page);

    // No card wrapper from lg: one title with the queue count, the strip and the table.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Cobranza · \d+$/);
    await expect(page.getByText('Saldos de tickets terminados', { exact: false })).toBeVisible();

    const total = await stripAmount(page, 'all');
    const parts =
      (await stripAmount(page, '0-30')) +
      (await stripAmount(page, '31-90')) +
      (await stripAmount(page, '90+'));
    expect(Math.round(parts * 100)).toBe(Math.round(total * 100));

    const folios = await page.getByTestId('cobranza-folio').allTextContents();
    expect(folios.length).toBeGreaterThan(0);
    for (const folio of folios) expect(folio).toMatch(/^[A-Z]+-\d{4,}$/);

    // Default order: the oldest work first; the last payment sits underneath.
    const rows = page.getByTestId('cobranza-row');
    const ages = await days(rows);
    expect(ages).toEqual([...ages].sort((a, b) => b - a));
    for (const line of await rows.getByTestId('cobranza-last-payment').allTextContents()) {
      // Relative for the last week (canvas «hace 1 día»), then the ListShortDate text
      // («3 ago», with the year only when it is not this one: «3 ago 2025»).
      expect(line).toMatch(
        /^(último pago (hoy|hace \d+ días?|\d{1,2} [a-z]{3,4}\.?( \d{4})?)|sin ningún pago)$/,
      );
    }

    // En proceso stays out of the queue and is named in the footer.
    await expect(page.getByTestId('cobranza-in-progress')).toContainText(/en proceso sum/);
    await expect(page.getByRole('link', { name: 'Ver en Tickets' })).toHaveAttribute(
      'href',
      '/tickets?status=due&finished=no',
    );

    // Más de 90 filters the table through the URL.
    await page.getByRole('tab', { name: /Más de 90 días/ }).click();
    await expect(page).toHaveURL(/tramo=90%2B/);
    await expect(page.getByRole('tab', { name: /Más de 90 días/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect
      .poll(async () => (await days(rows)).every((value) => value > 90), { timeout: 15_000 })
      .toBe(true);

    // The ⋯ is reachable with the keyboard from the row, after the visible Cobrar.
    await rows.first().focus();
    let reached = false;
    for (let i = 0; i < 6 && !reached; i += 1) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() =>
        (document.activeElement?.getAttribute('aria-label') ?? '').startsWith('Más acciones del ticket'),
      );
    }
    expect(reached).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Ver ticket' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Editar|Eliminar/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    // Radix keeps aria-hidden on the page until the menu has closed.
    await expect(page.getByRole('menu')).toHaveCount(0);

    await expectNoSeriousViolations(page, 'cobranza por ticket');
  });

  test('Hoy › Saldo por cobrar matches the strip', async ({ page }) => {
    await page.goto('/cobranza');
    await waitForQueue(page);
    const total = await stripAmount(page, 'all');

    await page.goto('/dashboard');
    const kpi = page.getByRole('link', { name: 'Ver cobranza: saldo por cobrar' });
    await expect(kpi).toContainText('$', { timeout: 30_000 });
    // The card leads with a compact figure ($441K) and prints the full amount under it.
    const amounts = [...((await kpi.textContent()) ?? '').matchAll(/\$\s?([\d,]+\.\d{2})/g)].map(
      (match) => Math.round(Number(match[1].replace(/,/g, '')) * 100),
    );
    expect(amounts).toContain(Math.round(total * 100));
  });

  test('Por cliente groups the museum and sends one estado de cuenta', async ({ page }) => {
    // The museum, its two tickets and the text are ClimaTotal Demo data.
    test.skip(
      (process.env.E2E_COMPANY_NAME ?? DEMO_COMPANY_NAME) !== DEMO_COMPANY_NAME,
      'Needs the ClimaTotal Demo tenant (E2E_COMPANY_NAME)',
    );
    await page.goto('/cobranza?ver=clientes');
    await expect(page.getByTestId('cobranza-client-row').first()).toBeVisible({ timeout: 30_000 });

    const museo = page
      .getByTestId('cobranza-client-row')
      .filter({ hasText: 'Museo de Arte Contemporáneo' });
    await expect(museo).toHaveCount(1);
    await expect(museo.getByTestId('cobranza-client-count')).toHaveText('2 tickets');
    await expect(museo.getByTestId('cobranza-client-balance')).toHaveText('$2,810.00');

    // Cobrar ▾ shows without hover; the estado de cuenta is in the ⋯ (ZIG-I33-3).
    await page.mouse.move(0, 0);
    const collect = museo.getByRole('button', { name: /Cobrar un ticket de Museo/ });
    await expect(collect).toBeVisible();
    expect(await shownWithoutHover(collect)).toBe(true);
    await captureWindowOpen(page);
    await museo.getByRole('button', { name: /Más acciones de Museo/ }).click();
    await page.getByRole('menuitem', { name: 'Estado de cuenta por WhatsApp' }).click();
    const href = (await openedUrls(page))[0] ?? '';
    expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    const text = decodeURIComponent(href.split('?text=')[1]);
    // The whole text of the canvas board CobAcciones (ClimaTotal Demo has no transfer data).
    expect(text).toBe(
      [
        'Hola, te escribe ClimaTotal Demo. Tienes 2 tickets con saldo pendiente:',
        '• R-0016 (2 ene 2026): $1,210.00',
        '• R-0036 (11 jun 2026): $1,600.00',
        'Total pendiente: $2,810.00.',
        'Cuando puedas, por favor confirma el pago. ¡Gracias!',
      ].join('\n'),
    );
    await expect(page.getByRole('menu')).toHaveCount(0);

    // The client row opens with Enter, like a button (ZIG-I33 §4).
    await museo.focus();
    await page.keyboard.press('Enter');
    const tickets = page.getByTestId('cobranza-client-ticket');
    await expect(tickets.filter({ hasText: 'R-0016' })).toHaveCount(1);
    await expect(tickets.filter({ hasText: 'R-0036' })).toHaveCount(1);
    await expect(museo.getByRole('button', { name: /Ocultar los tickets de Museo/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    await expectNoSeriousViolations(page, 'cobranza por cliente');

    // The client page offers the same estado de cuenta.
    await museo.getByRole('button', { name: /Más acciones de Museo/ }).click();
    await page.getByRole('menuitem', { name: 'Ver cliente' }).click();
    await expect(page).toHaveURL(/\/clients\/\d+/);
    const cardStatement = page.getByTestId('client-balance-statement');
    await expect(cardStatement).toBeVisible({ timeout: 30_000 });
    const cardText = decodeURIComponent(
      ((await cardStatement.getAttribute('href')) ?? '').split('?text=')[1] ?? '',
    );
    expect(cardText).toBe(text);
  });

  test('Cobrar shows without hover, WhatsApp is in the ⋯, headers sort on the server, numbered pager', async ({
    page,
  }) => {
    await page.goto('/cobranza');
    await waitForQueue(page);
    await page.mouse.move(0, 0);
    const rows = page.getByTestId('cobranza-row');

    // Cobrar on every row without hover; no WhatsApp button outside the ⋯ (ZIG-I33 §5).
    const collect = rows.first().getByRole('button', { name: /^Cobrar el ticket / });
    await expect(collect).toBeVisible();
    expect(await shownWithoutHover(collect)).toBe(true);
    await expect(rows.getByRole('link', { name: /WhatsApp/ })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Ordenar' })).toHaveCount(0);

    // Recordar por WhatsApp is a ⋯ item of a row with a phone.
    let whatsApp = false;
    const count = Math.min(await rows.count(), 6);
    for (let index = 0; index < count && !whatsApp; index += 1) {
      await rows.nth(index).getByRole('button', { name: /^Más acciones del ticket / }).click();
      await expect(page.getByRole('menuitem', { name: 'Ver ticket' })).toBeVisible();
      whatsApp = (await page.getByRole('menuitem', { name: 'Recordar por WhatsApp' }).count()) > 0;
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).toHaveCount(0);
    }
    expect(whatsApp).toBe(true);

    // Días sin pagar is the default order; Saldo sorts from its header, on the server.
    const daysHeader = page.getByRole('columnheader', { name: /Días sin pagar/ });
    await expect(daysHeader).toHaveAttribute('aria-sort', 'descending');
    await page.getByRole('button', { name: /^Saldo/ }).click();
    await expect(page).toHaveURL(/orden=balance(?!-)/);
    await expect(page.getByRole('columnheader', { name: /^Saldo/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await expect
      .poll(async () => {
        const values = await balances(rows);
        return values.every((value, index) => index === 0 || values[index - 1] >= value);
      }, { timeout: 15_000 })
      .toBe(true);
    const descending = await balances(rows);

    await page.getByRole('button', { name: /^Saldo/ }).click();
    await expect(page).toHaveURL(/orden=balance-asc/);
    await expect
      .poll(async () => {
        const values = await balances(rows);
        return values.every((value, index) => index === 0 || values[index - 1] <= value);
      }, { timeout: 15_000 })
      .toBe(true);
    // The server sorts the whole queue (?orden= goes to getCobranzaPaginated): the first
    // row now owes no more than any row of the largest-first page.
    expect((await balances(rows))[0]).toBeLessThanOrEqual(Math.min(...descending));

    // The footer counts with a noun and the sum; the numbered pager only with a second page.
    const footer = page.getByTestId('cobranza-footer');
    await expect(footer).toContainText(/de \d+ tickets? · suman \$/);
    const total = Number(/de (\d+) tickets?/.exec((await footer.textContent()) ?? '')?.[1] ?? 0);
    const pager = footer.getByRole('navigation', { name: 'Paginación' });
    if (total > 25) {
      await expect(footer).toContainText(`1–25 de ${total} tickets`);
      await expect(pager.getByRole('button', { name: 'Página 1' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await pager.getByRole('button', { name: 'Página 2' }).click();
      await expect(footer).toContainText(new RegExp(`26–\\d+ de ${total} tickets`));
      await expect(pager.getByRole('button', { name: 'Página 2' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    } else {
      await expect(pager).toHaveCount(0);
    }

    await expectNoSeriousViolations(page, 'cobranza ordenada por saldo');
  });

  test('Cobrar with Todo el saldo settles the ticket and offers Enviar recibo', async ({ page }) => {
    await page.goto('/cobranza');
    await waitForQueue(page);
    const before = await stripAmount(page, 'all');

    const row = page.getByTestId('cobranza-row').first();
    const folio = (await row.getByTestId('cobranza-folio').textContent())!.trim();
    const saldo = money(await row.getByTestId('cobranza-balance').textContent());

    await row.getByRole('button', { name: `Cobrar el ticket ${folio}` }).click();
    const dialog = page.getByRole('dialog', { name: `Cobrar ticket ${folio}` });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('radio', { name: 'Todo el saldo' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await dialog.getByRole('radio', { name: /^La mitad/ }).click();
    const half = (await dialog.getByLabel('¿Cuánto pagó?').inputValue()).replace(/,/g, '');
    expect(Number(half)).toBeCloseTo(
      Math.round((saldo / 2) * 100) / 100,
      2,
    );
    await dialog.getByRole('radio', { name: 'Todo el saldo' }).click();
    await expectNoSeriousViolations(page, 'cobrar dialog');

    await dialog.getByRole('button', { name: 'Anotar cobro' }).click();
    await expect(page.getByText('Listo, quedó pagado')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Enviar recibo' })).toBeVisible();

    await expect(page.getByTestId('cobranza-folio').filter({ hasText: folio })).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect
      .poll(async () => Math.round((await stripAmount(page, 'all')) * 100), { timeout: 15_000 })
      .toBe(Math.round((before - saldo) * 100));
  });
});
