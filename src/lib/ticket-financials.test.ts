import { calculateTicketTotal } from '@/lib/ticket-financials';

describe('ticket financials', () => {
  it('calculates a stable total from quantity and unit price lines', () => {
    const total = calculateTicketTotal([
      { quantity: 2, price: 59.99 },
      { quantity: 1, price: 700 },
      { quantity: 3, price: 12.5 },
    ]);

    expect(total).toBeCloseTo(857.48, 2);
  });

  it('returns zero when no lines are provided', () => {
    expect(calculateTicketTotal([])).toBe(0);
  });
});
