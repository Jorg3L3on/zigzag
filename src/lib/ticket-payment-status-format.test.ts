import {
  formatTicketListAmount,
  getTicketPaymentProgressRatio,
  isTicketFullyPaid,
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

describe('isTicketFullyPaid', () => {
  it('is true when paid covers total', () => {
    expect(isTicketFullyPaid(100, 100)).toBe(true);
    expect(isTicketFullyPaid(100, 100.005)).toBe(true);
  });

  it('is false for pending, partial, or zero-total tickets', () => {
    expect(isTicketFullyPaid(100, 0)).toBe(false);
    expect(isTicketFullyPaid(100, 40)).toBe(false);
    expect(isTicketFullyPaid(0, 0)).toBe(false);
    expect(isTicketFullyPaid(null, null)).toBe(false);
  });
});
