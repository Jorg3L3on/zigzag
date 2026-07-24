import {
  describeTicketAuditEvent,
  extractTicketAuditAmount,
  formatTicketTimelineEntry,
  formatTicketTimelineTitle,
  getTicketTimelineIcon,
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

  it('builds human-friendly timeline titles without ticket refs', () => {
    expect(
      formatTicketTimelineTitle({
        eventType: 'created',
        actorName: 'Carlos',
        payload: null,
      }),
    ).toBe('Carlos creó el ticket');

    expect(
      formatTicketTimelineTitle({
        eventType: 'payment_collected',
        actorName: 'Ana',
        payload: { payment: { appliedAmount: 1250 } },
      }),
    ).toMatch(/^Ana registró un pago de \$/);

    expect(
      formatTicketTimelineTitle({
        eventType: 'updated',
        actorName: 'Luis',
        payload: { servicesChanged: true },
      }),
    ).toBe('Luis actualizó los servicios del ticket');
  });

  it('uses Alguien when actor is missing', () => {
    expect(
      formatTicketTimelineTitle({
        eventType: 'finished',
        actorName: null,
        payload: null,
      }),
    ).toBe('Alguien finalizó el ticket');
  });

  it('maps event types to timeline icons', () => {
    expect(getTicketTimelineIcon('payment_collected')).toBe('payment');
    expect(getTicketTimelineIcon('created')).toBe('ticket');
    expect(getTicketTimelineIcon('unknown')).toBe('generic');
  });

  it('returns a formatted timeline entry bundle', () => {
    const entry = formatTicketTimelineEntry({
      eventType: 'payment_collected',
      actorName: 'Ana',
      payload: { payment: { appliedAmount: 100 } },
    });
    expect(entry.icon).toBe('payment');
    expect(entry.amount).toBe(100);
    expect(entry.title).toContain('Ana registró un pago');
  });
});
