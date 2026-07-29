import {
  formatTicketListAmount,
  getTicketPaymentProgressRatio,
} from '@/lib/ticket-payment-status';

describe('formatTicketListAmount', () => {
  it('omits cents for whole amounts', () => {
    expect(formatTicketListAmount(15000)).toBe('$15,000');
    expect(formatTicketListAmount(0)).toBe('$0');
  });

  it('keeps cents when present', () => {
    expect(formatTicketListAmount(15000.5)).toBe('$15,000.50');
  });

  it('handles null', () => {
    expect(formatTicketListAmount(null)).toBe('Sin total');
  });
});

describe('getTicketPaymentProgressRatio', () => {
  it('is exported from payment status helpers', () => {
    expect(getTicketPaymentProgressRatio(200, 50)).toBeCloseTo(0.25);
  });
});
