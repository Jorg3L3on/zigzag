import {
  describeTicketAuditEvent,
  extractTicketAuditAmount,
} from '@/lib/ticket-audit-display';

describe('ticket audit display', () => {
  it('maps known event types to Spanish labels', () => {
    expect(describeTicketAuditEvent('payment_collected')).toBe('Pago registrado');
    expect(describeTicketAuditEvent('finished')).toBe('Ticket finalizado');
  });

  it('falls back to the raw event type for unknown events', () => {
    expect(describeTicketAuditEvent('mystery_event')).toBe('mystery_event');
  });

  it('extracts the applied amount from a payment event', () => {
    expect(
      extractTicketAuditAmount('payment_collected', {
        payment: { appliedAmount: 150.5 },
      }),
    ).toBe(150.5);
  });

  it('extracts the initial payment from a finished event', () => {
    expect(
      extractTicketAuditAmount('finished', { initialPayment: 99.99 }),
    ).toBe(99.99);
  });

  it('returns null when no amount is present', () => {
    expect(extractTicketAuditAmount('updated', { foo: 'bar' })).toBeNull();
    expect(extractTicketAuditAmount('payment_collected', null)).toBeNull();
  });
});
