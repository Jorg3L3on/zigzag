import {
  calculateServicesTotal,
  formatServiceCurrency,
  sanitizeDecimal,
  sanitizeInteger,
} from '@/components/tickets/ticket-services-utils';

describe('ticket-services-utils', () => {
  it('sanitizes numeric inputs', () => {
    expect(sanitizeInteger('abc', 2)).toBe(2);
    expect(sanitizeInteger('0')).toBe(1);
    expect(sanitizeInteger('5')).toBe(5);
    expect(sanitizeDecimal('-3', 1)).toBe(0);
    expect(sanitizeDecimal('12.5')).toBe(12.5);
  });

  it('formats currency and totals', () => {
    expect(formatServiceCurrency(10)).toContain('$');
    expect(
      calculateServicesTotal([
        { quantity: 2, price: 10 },
        { quantity: 1, price: 5 },
      ]),
    ).toBe(25);
  });
});
