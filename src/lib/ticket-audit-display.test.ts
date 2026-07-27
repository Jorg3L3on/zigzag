import {
  buildTicketAuditFieldDetails,
  buildTicketAuditUpdateDetails,
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
    ).toBe('Luis actualizó el ticket');
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
    expect(entry.details).toEqual([]);
  });

  it('builds field-level de→a details from before/after snapshots', () => {
    const details = buildTicketAuditFieldDetails({
      before: {
        client_name: 'Ana',
        client_tel: '555',
        email: 'a@x.com',
        document: 'X1',
        ticket_date: '2024-01-10T00:00:00.000Z',
        total: 100,
        client_id: 1,
      },
      after: {
        client_name: 'Ana',
        client_tel: '666',
        email: 'a@x.com',
        document: 'X1',
        ticket_date: '2024-01-10T00:00:00.000Z',
        total: 100,
        client_id: 2,
      },
    });

    expect(details).toEqual(['teléfono: 555 → 666']);
    expect(details.some((line) => line.includes('client_id'))).toBe(false);
  });

  it('names the service when the audit payload includes it', () => {
    const entry = formatTicketTimelineEntry({
      eventType: 'updated',
      actorName: 'María',
      payload: {
        serviceLine: 'created',
        serviceName: 'Limpieza HVAC',
        line: { service_id: 9, quantity: 1, price: 50 },
      },
    });

    expect(entry.title).toBe('María actualizó el ticket');
    expect(entry.details).toEqual(['Servicio añadido: Limpieza HVAC']);
  });

  it('formats historical updates from existing before/after payloads', () => {
    const entry = formatTicketTimelineEntry({
      eventType: 'updated',
      actorName: 'Luis',
      payload: {
        before: {
          client_name: 'Hotel Sol',
          client_tel: '111',
          email: null,
          document: null,
          ticket_date: '2024-02-01T12:00:00.000Z',
          total: 200,
        },
        after: {
          client_name: 'Hotel Luna',
          client_tel: '111',
          email: 'luna@x.com',
          document: null,
          ticket_date: '2024-02-01T12:00:00.000Z',
          total: 250,
        },
        servicesChanged: false,
      },
    });

    expect(entry.title).toBe('Luis actualizó el ticket');
    expect(entry.details).toEqual(
      expect.arrayContaining([
        'cliente: Hotel Sol → Hotel Luna',
        'email: — → luna@x.com',
        expect.stringMatching(/^total: /),
      ]),
    );
  });

  it('includes restore note and generic service change when no names', () => {
    expect(
      buildTicketAuditUpdateDetails({
        restored: true,
        before: { client_name: 'A' },
        after: { client_name: 'A' },
        servicesChanged: true,
      }),
    ).toEqual([
      'Ticket restaurado desde la papelera',
      'Servicios del ticket actualizados',
    ]);
  });
});
