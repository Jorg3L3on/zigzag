import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

/**
 * ZIG-I36-17/-18/-19 (T6 group 3) on the phone: the card names En proceso vs Por cobrar,
 * shows the work and Faltan, and Hoy › Por cobrar rows use the folio, not the id.
 */
const OWNER = 'dueno@auditoria-pesada.test';
const PASSWORD = process.env.AUDIT_SEED_PASSWORD ?? 'Auditoria-2026';

test.describe('Tickets cards and Hoy on the phone (audit tenant)', () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 393, height: 852 } });

  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER, PASSWORD);
  });

  test('cards: En proceso never reads Por cobrar; owed cards say Faltan; work with materiales', async ({ page }) => {
    await page.goto('/tickets');
    const cards = page.getByRole('button', { name: /ticket \d+/i });
    await expect(cards.first()).toBeVisible();
    const metas = page.getByTestId('ticket-card-meta');
    const texts = await metas.allInnerTexts();
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.join('\n')).not.toContain('Pendiente');
    for (const text of texts) {
      if (text.includes('En proceso')) expect(text).not.toContain('Por cobrar');
    }
    const summaries = await page.getByTestId('ticket-payment-summary').allInnerTexts();
    for (const [index, text] of texts.entries()) {
      if (text.includes('Por cobrar')) expect(summaries[index]).toContain('Faltan');
      if (text.includes('En proceso')) expect(summaries[index]).not.toContain('Faltan');
    }
    await expect(page.getByTestId('ticket-card-services').first()).toContainText(/materiales?|\w/);
    expect(await page.getByTestId('ticket-card-services').allInnerTexts()).toEqual(
      expect.arrayContaining([expect.stringMatching(/· \d+ materiales?/)]),
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('Hoy › Por cobrar rows: client, then folio · hace N días, amount and Cobrar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('tab', { name: /Por cobrar/ }).click();
    const list = page.getByRole('list', { name: 'Tu día: Por cobrar' });
    const first = list.getByRole('listitem').first();
    await expect(first).toBeVisible();
    await expect(first).toContainText(/[A-Z]+-\d{4} · hace \d+ días?/);
    await expect(first).not.toContainText('#');
    await expect(first.getByRole('button', { name: /Cobrar/ })).toBeVisible();
  });
});
