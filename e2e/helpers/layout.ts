import { expect, type Page } from '@playwright/test';

/**
 * What the user sees on a phone (ZIG-I13-8): the page never scrolls sideways, no
 * clipping container hides content, nothing sits past the visual viewport and no
 * money is cut off. Money is every `MoneyFigure` (`data-money-size`) plus the test
 * ids listed below. Names may truncate with an ellipsis by design; amounts never.
 */
const MONEY_TEST_IDS = [
  'composer-total',
  'composer-sticky-total',
  'composer-line-subtotal',
  'document-line-amount',
  'review-total',
  'review-sticky-amount',
  'ticket-hero-amount',
  'presupuesto-counts',
];

export const expectLayoutIntact = async (page: Page, label: string) => {
  const report = await page.evaluate((moneyIds) => {
    const visualWidth = window.visualViewport?.width ?? window.innerWidth;
    const shown = (el: Element) => el.getClientRects().length > 0;

    const clipped = [...document.querySelectorAll<HTMLElement>('[class*="overflow-x-hidden"]')]
      .filter(shown)
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollLeft > 0)
      .map((el) => `${el.tagName}.${String(el.className).slice(0, 60)} ${el.scrollWidth}>${el.clientWidth}`);

    const moneySelector = ['[data-money-size]', ...moneyIds.map((id) => `[data-testid="${id}"]`)].join(',');
    const cut = [...document.querySelectorAll<HTMLElement>(moneySelector)]
      .filter(shown)
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || getComputedStyle(el).textOverflow === 'ellipsis')
      .map((el) => `${el.getAttribute('data-testid') ?? 'money'}: ${el.textContent}`);

    // The two-part money row of a list card: spans must not clip either.
    const rowCut = [...document.querySelectorAll<HTMLElement>('[data-testid="ticket-payment-summary"] span')]
      .filter(shown)
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => `ticket-payment-summary: ${el.textContent}`);

    const outside = [...document.querySelectorAll<HTMLElement>('main [data-testid], [role="list"] li')]
      .filter(shown)
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return box.right > visualWidth + 1 || box.left < -1;
      })
      .map((el) => `${el.getAttribute('data-testid') ?? el.tagName}: ${Math.round(el.getBoundingClientRect().right)}`);

    return {
      page: document.documentElement.scrollWidth - Math.ceil(visualWidth),
      clipped,
      cut: [...cut, ...rowCut],
      outside,
    };
  }, MONEY_TEST_IDS);

  expect(report.page, `${label}: document wider than the viewport`).toBeLessThanOrEqual(0);
  expect(report.clipped, `${label}: clipped content`).toEqual([]);
  expect(report.cut, `${label}: truncated money`).toEqual([]);
  expect(report.outside, `${label}: elements past the viewport`).toEqual([]);
};
