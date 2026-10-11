import { test, expect, type Page } from '@playwright/test';
import {
  e2eCredentialsSkipReason,
  ensureTenantCompany,
  hasE2eCredentials,
  login,
} from './helpers/auth';
import { addInlineComposerLine } from './helpers/ticket-composer';
import { extractPdfText, pageText, type PdfTextPage } from '../src/test/pdf-text';

/**
 * ZIG-I12 replay of the 2026-10-10 QA run, at 375px and 333px: a ticket and a
 * presupuesto built to break the composer (100-char unbroken names, 10-digit
 * totals, 9,999.99 material units, emoji / CJK / Arabic / HTML names, 2,000-char
 * notes with blank-line runs, a partial payment typed with three decimals).
 * Asserts the exact stored and displayed money (no phantom cents), that nothing
 * is wider than what the user sees, that money is never truncated and that the
 * PDF text carries the exact totals, the notes and the full concept names.
 *
 * This spec saves data: run it in CI or against a scratch database, never
 * against production.
 */

const LONG_NAME = 'X'.repeat(100);
const HOSTILE_NAME = '<b>Urgente</b> 🔥 维修 صيانة <img src=x onerror=alert(1)>';

const money = (value: number) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// 99 × $99,999,990 + 9,999.99 × $1 (material), then 1.5 × $100.
const TICKET_LINE_1 = 99 * 99_999_990 + 9_999.99;
const TICKET_TOTAL = 9_900_009_159.99;
const PARTIAL_PAID = 1_234.57;
const TICKET_BALANCE = 9_900_007_925.42;

/** Test ids whose text must always show in full (never an ellipsis). */
const MONEY_TEST_IDS = [
  'composer-total',
  'composer-sticky-total',
  'document-line-amount',
  'review-total',
  'review-line-amount',
  'review-sticky-amount',
];

/**
 * What the user sees: no horizontal overflow of the page or of a clipping
 * container, nothing past the visual viewport, and money shown in full.
 */
const expectLayoutIntact = async (page: Page, label: string) => {
  const report = await page.evaluate((moneyIds) => {
    const visualWidth = window.visualViewport?.width ?? window.innerWidth;
    const clipped = [...document.querySelectorAll<HTMLElement>('[class*="overflow-x-hidden"]')]
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollLeft > 0)
      .map((el) => {
        const edge = el.getBoundingClientRect().right;
        const culprits = [...el.querySelectorAll<HTMLElement>('*')]
          .filter((child) => child.getBoundingClientRect().right > edge + 1)
          .slice(0, 4)
          .map(
            (child) =>
              `${child.tagName}[${child.getAttribute('data-testid') ?? ''}].${String(child.className).slice(0, 50)} "${(child.textContent ?? '').slice(0, 30)}"`,
          );
        return `${el.tagName}.${String(el.className).slice(0, 60)} ${el.scrollWidth}>${el.clientWidth} <- ${culprits.join(' | ')}`;
      });
    const cut = moneyIds.flatMap((id) =>
      [...document.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)]
        .filter((el) => el.getClientRects().length > 0)
        .filter(
          (el) =>
            el.scrollWidth > el.clientWidth + 1 ||
            getComputedStyle(el).textOverflow === 'ellipsis',
        )
        .map((el) => `${id}: ${el.textContent}`),
    );
    const outside = [...document.querySelectorAll<HTMLElement>('main [data-testid], [role="list"] li')]
      .filter((el) => el.getClientRects().length > 0)
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return box.right > visualWidth + 1 || box.left < -1;
      })
      .map((el) => `${el.getAttribute('data-testid') ?? el.tagName}: ${Math.round(el.getBoundingClientRect().right)}`);
    return {
      page: document.documentElement.scrollWidth - Math.ceil(visualWidth),
      clipped,
      cut,
      outside,
    };
  }, MONEY_TEST_IDS);

  expect(report.page, `${label}: document wider than the viewport`).toBeLessThanOrEqual(0);
  expect(report.clipped, `${label}: clipped content`).toEqual([]);
  expect(report.cut, `${label}: truncated money`).toEqual([]);
  expect(report.outside, `${label}: elements past the viewport`).toEqual([]);
};

const fetchPdfPages = async (page: Page, path: string): Promise<PdfTextPage[]> => {
  const base64 = await page.evaluate(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`PDF ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }, path);
  return extractPdfText(Buffer.from(base64, 'base64'));
};

const squash = (value: string) => value.replace(/\s+/g, '');

const createLongClient = async (page: Page, suffix: string) => {
  await page.getByRole('button', { name: 'Nuevo cliente' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nuevo cliente' });
  await expect(dialog).toBeVisible();

  const name = dialog.getByLabel('Nombre');
  await name.click();
  // pressSequentially honours maxLength, like a person typing: 120 typed, 100 kept.
  await name.pressSequentially(`H${suffix}${'x'.repeat(120)}`);
  await expect(name).toHaveValue(`H${suffix}${'x'.repeat(120)}`.slice(0, 100));
  await expect(dialog.getByTestId('char-counter')).toHaveText('100/100');

  await dialog.getByLabel('Teléfono').fill('+52 (998) 100-0000 ext. 12345');
  await expect(dialog.getByRole('status')).toContainText(
    'Guardamos solo dígitos: 52998100000012345',
  );

  await dialog.getByRole('button', { name: 'Crear' }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByTestId('composer-party-card')).toContainText(`H${suffix}`);
};

/** A saved-nowhere line typed with Nuevo, optionally with one inline material. */
const addHostileLine = async (
  page: Page,
  {
    name,
    quantity,
    price,
    material,
  }: {
    name: string;
    quantity: string;
    price: string;
    material?: { name: string; quantity: string; price: string };
  },
) => {
  await page.getByRole('button', { name: 'Agregar servicio' }).click();
  const sheet = page.getByRole('dialog', { name: 'Agregar servicio' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('radio', { name: /Nuevo/ }).click();
  await sheet.getByLabel('Nombre del servicio').fill(name);
  await sheet.getByRole('spinbutton', { name: 'Cantidad del servicio' }).fill(quantity);
  await sheet.getByRole('spinbutton', { name: 'Precio del servicio' }).fill(price);

  if (material) {
    await sheet.getByRole('button', { name: 'Agregar material' }).click();
    const materialSheet = page.getByRole('dialog', { name: 'Agregar material' });
    await expect(materialSheet).toBeVisible();
    // One tap on Nuevo must switch modes: the hint used to vanish on blur and move the button.
    await materialSheet.getByRole('radio', { name: /Nuevo/ }).click();
    await expect(materialSheet.getByLabel('Nombre del material')).toBeVisible();
    await materialSheet.getByLabel('Nombre del material').fill(material.name);
    await materialSheet.getByLabel('Cantidad').fill(material.quantity);
    await materialSheet.getByLabel(/^Precio/).fill(material.price);
    await materialSheet.getByRole('button', { name: 'Agregar material' }).click();
    await expect(materialSheet.getByLabel('Nombre del material')).toBeHidden({ timeout: 10_000 });
  }

  await sheet.getByRole('button', { name: 'Guardar línea' }).click();
  await expect(sheet).toBeHidden({ timeout: 10_000 });
};

const NOTES = `${'Z'.repeat(150)}${'\n'.repeat(6)}${'Cláusula de garantía de 30 días en refacciones. '.repeat(50)}`.slice(
  0,
  2000,
);

for (const width of [375, 333]) {
  test.describe(`Composer adversarial run @${width}px`, () => {
    test.use({ viewport: { width, height: 812 } });
    test.setTimeout(300_000);

    test.beforeEach(async ({ page }) => {
      test.skip(!hasE2eCredentials, e2eCredentialsSkipReason);
      await login(page);
      await ensureTenantCompany(page);
    });

    test('ticket: exact money, no overflow, nothing truncated, PDF carries it all', async ({
      page,
    }) => {
      const suffix = `${Date.now()}`.slice(-8);
      await page.goto('/tickets/create');
      await expect(page.getByRole('heading', { name: 'Cliente', exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await createLongClient(page, suffix);

      await addHostileLine(page, {
        name: LONG_NAME,
        quantity: '99',
        price: '99999990',
        material: { name: 'M'.repeat(100), quantity: '9999.99', price: '1' },
      });
      // Names the PDF cannot print are flagged while typing (Q3).
      await page.getByRole('button', { name: 'Agregar servicio' }).click();
      const sheet = page.getByRole('dialog', { name: 'Agregar servicio' });
      await sheet.getByRole('radio', { name: /Nuevo/ }).click();
      await sheet.getByLabel('Nombre del servicio').fill(HOSTILE_NAME);
      await expect(sheet.getByTestId('pdf-chars-warning')).toContainText(
        'Estos caracteres no salen en el PDF',
      );
      await sheet.getByRole('spinbutton', { name: 'Cantidad del servicio' }).fill('1.5');
      await sheet.getByRole('spinbutton', { name: 'Precio del servicio' }).fill('100');
      await sheet.getByRole('button', { name: 'Guardar línea' }).click();
      await expect(sheet).toBeHidden({ timeout: 10_000 });

      // 1.5 stays 1.5; HTML is text; the total is exact (no phantom cents).
      const lines = page.getByRole('list', { name: 'Servicios del ticket' });
      await expect(lines.getByText('1.5 × $100.00')).toBeVisible();
      await expect(lines.getByText(HOSTILE_NAME, { exact: false }).first()).toBeVisible();
      expect(await page.locator('main b, main img[src="x"]').count()).toBe(0);
      await expect(page.getByTestId('composer-total')).toHaveText(money(TICKET_TOTAL));
      await expect(page.getByTestId('document-line-amount').first()).toHaveText(
        money(TICKET_LINE_1),
      );

      await page.getByRole('textbox', { name: /Notas/ }).fill(NOTES);
      await expect(page.getByTestId('char-counter')).toBeVisible();

      // Focusing a line row must not scroll the composer sideways.
      await page.getByTestId('composer-line-row').first().focus();
      await expectLayoutIntact(page, 'composer');

      await page.getByRole('button', { name: /^Guardar( ticket)?$/ }).first().click();
      await page.waitForURL(/\/tickets\/\d+\/listo$/, { timeout: 60_000 });
      const ticketId = page.url().match(/\/tickets\/(\d+)/)?.[1] as string;
      expect(ticketId).toBeTruthy();

      await expect(
        page.getByText(`Ticket #${ticketId} guardado`).filter({ visible: true }).first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('review-total')).toHaveText(money(TICKET_TOTAL));
      // The Resumen replaces the full recibo; no blank PDF box (ZIG-I13-3).
      await expect(page.getByTestId('review-summary')).toBeVisible();
      await expect(page.getByTestId('recibo-summary')).toHaveCount(0);
      await expect(page.getByTestId('recibo-pdf-preview')).toHaveCount(0);

      // No payment is chosen for the user: Finalizar waits for a choice.
      const finish = page.getByRole('button', { name: 'Finalizar y compartir' }).first();
      await expect(finish).toBeDisabled();
      await page.getByRole('radio', { name: 'Una parte' }).click();
      await page.getByLabel('Cuánto pagó').fill('1234.567');
      await expect(page.getByTestId('review-sticky-amount')).toHaveText(money(TICKET_BALANCE));
      await expectLayoutIntact(page, 'listo');

      await page.evaluate(() => {
        window.open = (() => null) as typeof window.open;
      });
      await finish.click();
      await expect(
        page.getByText(`Ticket #${ticketId} finalizado`).filter({ visible: true }).first(),
      ).toBeVisible({ timeout: 60_000 });
      await expect(page.getByRole('button', { name: /Compartir recibo/ }).first()).toBeEnabled({
        timeout: 60_000,
      });

      // Detail: Total / Pagado / Saldo exact and whole.
      await page.goto(`/tickets/${ticketId}`);
      const bar = page.locator('[aria-label^="Resumen de montos"]').filter({ visible: true }).first();
      await expect(bar).toBeVisible({ timeout: 15_000 });
      await expect(bar).toContainText(money(TICKET_TOTAL));
      await expect(bar).toContainText(money(PARTIAL_PAID));
      await expect(bar).toContainText(money(TICKET_BALANCE));
      expect(
        await bar.evaluate((el) =>
          [...el.querySelectorAll<HTMLElement>('p')].filter(
            (p) => p.scrollWidth > p.clientWidth + 1 || getComputedStyle(p).textOverflow === 'ellipsis',
          ).length,
        ),
      ).toBe(0);
      await expect(page.getByText(LONG_NAME).first()).toBeVisible();
      await expectLayoutIntact(page, 'detail');

      // List card: paid / total / Faltan visible in full.
      await page.goto('/tickets');
      const card = page.getByRole('button', { name: new RegExp(`ticket ${ticketId}$`) }).first();
      await expect(card).toBeVisible({ timeout: 15_000 });
      await expect(card.getByTestId('ticket-payment-summary')).toContainText(money(PARTIAL_PAID));
      await expect(card.getByTestId('ticket-payment-summary')).toContainText(money(TICKET_BALANCE));
      await expectLayoutIntact(page, 'list');

      // The PDF: exact numbers, the notes block and the whole concept name.
      await page.goto(`/tickets/${ticketId}`);
      const pdf = await fetchPdfPages(page, `/api/tickets/${ticketId}/invoice`);
      const text = pdf.map(pageText).join(' ');
      expect(text).toContain(`${money(TICKET_TOTAL)} MXN`);
      expect(text).toContain(`${money(PARTIAL_PAID)} MXN`);
      expect(text).toContain(`${money(TICKET_BALANCE)} MXN`);
      expect(text).toContain('PAGO PARCIAL');
      expect(text).toContain('NOTAS');
      expect(squash(text)).toContain('Z'.repeat(150));
      expect(squash(text)).toContain('Cláusuladegarantía');
      expect(text).not.toContain('�');
      expect(text).not.toMatch(/🔥|维|修|ص/u);
      const nameRuns = pdf
        .flatMap((p) => p.runs)
        .filter((run) => run.font === 'PlexSans-SemiBold' && run.size === 10.5 && /^X+$/.test(run.text));
      expect(nameRuns.map((run) => run.text).join('')).toBe(LONG_NAME);
    });

    test('presupuesto: six hostile lines, conditions in the PDF, cap refuses the seventh', async ({
      page,
    }) => {
      const suffix = `${Date.now()}`.slice(-8);
      await page.goto('/presupuestos/create');
      await expect(page.getByRole('heading', { name: 'Cliente', exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await createLongClient(page, suffix);

      const names = Array.from({ length: 6 }, (_, index) => `${index + 1}${'Y'.repeat(99)}`);
      for (const name of names) {
        await addInlineComposerLine(
          page,
          { name, quantity: 99, price: 9_999_990 },
          'Servicios del presupuesto',
        );
      }
      const PRESUPUESTO_TOTAL = 6 * 99 * 9_999_990;
      await expect(page.getByTestId('composer-total')).toHaveText(money(PRESUPUESTO_TOTAL));

      // A seventh line that would pass the cap is explained, not saved.
      await page.getByRole('button', { name: 'Agregar servicio' }).click();
      const sheet = page.getByRole('dialog', { name: 'Agregar servicio' });
      await sheet.getByRole('radio', { name: /Nuevo/ }).click();
      await sheet.getByLabel('Nombre del servicio').fill('Demasiado');
      await sheet.getByRole('spinbutton', { name: 'Cantidad del servicio' }).fill('9999');
      await sheet.getByRole('spinbutton', { name: 'Precio del servicio' }).fill('99999999.99');
      await expect(sheet.getByTestId('composer-line-total-error')).toContainText(
        '$9,999,999,999.99',
      );
      await expect(sheet.getByRole('button', { name: 'Guardar línea' })).toBeDisabled();
      await sheet.getByRole('button', { name: 'Cancelar' }).click();
      await expect(sheet).toBeHidden();

      await page
        .getByRole('textbox', { name: /Notas/ })
        .fill('50% anticipo, saldo contra entrega.\n\n\n\nEl cliente compra el equipo.');
      await expectLayoutIntact(page, 'presupuesto composer');

      await page.getByRole('button', { name: /^Guardar( presupuesto)?$/ }).first().click();
      await page.waitForURL(/\/presupuestos\/\d+\/listo$/, { timeout: 60_000 });
      const presupuestoId = page.url().match(/\/presupuestos\/(\d+)/)?.[1] as string;
      await expect(page.getByTestId('review-total')).toHaveText(money(PRESUPUESTO_TOTAL), {
        timeout: 15_000,
      });
      await expect(page.getByTestId('presupuesto-pdf-preview')).toHaveCount(0);
      await expectLayoutIntact(page, 'presupuesto listo');

      await page.goto(`/presupuestos/${presupuestoId}`);
      await expect(page.getByTestId('presupuesto-notes').filter({ visible: true }).first()).toContainText('El cliente compra el equipo.');
      await expectLayoutIntact(page, 'presupuesto detail');

      const pdf = await fetchPdfPages(page, `/api/tickets/${presupuestoId}/invoice`);
      const text = pdf.map(pageText).join(' ');
      expect(text).toContain(`${money(PRESUPUESTO_TOTAL)} MXN`);
      expect(text).toContain('CONDICIONES Y NOTAS');
      expect(text).toContain('50% anticipo, saldo contra entrega.');
      expect(text).toContain('El cliente compra el equipo.');
      const printed = squash(
        pdf
          .flatMap((p) => p.runs)
          .filter((run) => run.font === 'PlexSans-SemiBold' && run.size === 10.5)
          .map((run) => run.text)
          .join(''),
      );
      for (const name of names) expect(printed).toContain(name);
    });
  });
}
