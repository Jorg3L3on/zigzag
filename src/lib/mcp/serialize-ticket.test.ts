import {
  mapAgentTicketDetail,
  mapAgentTicketSummary,
  parseAgentTicketId,
} from '@/lib/mcp/serialize-ticket';

describe('mapAgentTicketSummary', () => {
  it('JSON.stringify does not throw on list_tickets-shaped payload', () => {
    const payload = mapAgentTicketSummary({
      id: 9001n,
      client_id: 42,
      client_name: 'Sample Client',
      ticket_date: new Date('2026-01-15T10:00:00.000Z'),
      total: '150.00',
      paid: '0.00',
      finished: false,
      company_id: 7,
      created_at: new Date('2026-01-15T10:00:00.000Z'),
    });

    expect(() => JSON.stringify(payload)).not.toThrow();
    expect(payload.id).toBe('9001');
    expect(payload).not.toHaveProperty('client_tel');
    expect(payload).not.toHaveProperty('userId');
    expect(payload).not.toHaveProperty('email');
  });
});

describe('mapAgentTicketDetail', () => {
  it('JSON.stringify does not throw on get_ticket-shaped payload with line items', () => {
    const payload = mapAgentTicketDetail({
      id: 9002n,
      client_id: 43,
      client_name: 'Sample Client B',
      ticket_date: new Date('2026-01-16T12:00:00.000Z'),
      total: '200.00',
      paid: '50.00',
      finished: true,
      company_id: 7,
      created_at: new Date('2026-01-16T12:00:00.000Z'),
      services_tickets: [
        {
          id: 1,
          service_id: 10,
          quantity: 2,
          price: '100.00',
        },
      ],
    });

    expect(() => JSON.stringify({ ticket: payload })).not.toThrow();
    expect(payload.services_tickets).toEqual([
      { id: 1, service_id: 10, quantity: 2, price: '100.00' },
    ]);
    expect(payload).not.toHaveProperty('client_tel');
    expect(payload).not.toHaveProperty('userId');
  });

  it('omits bigint-only ticket fields that list_tickets excludes', () => {
    const payload = mapAgentTicketDetail({
      id: 9003n,
      client_id: null,
      client_name: null,
      ticket_date: null,
      total: null,
      paid: null,
      finished: false,
      company_id: 7,
      created_at: new Date('2026-01-17T08:00:00.000Z'),
      services_tickets: [],
    });

    const keys = Object.keys(payload).sort();
    expect(keys).toEqual([
      'client_id',
      'client_name',
      'company_id',
      'created_at',
      'finished',
      'id',
      'paid',
      'services_tickets',
      'ticket_date',
      'total',
    ]);
  });
});

describe('parseAgentTicketId', () => {
  it('coerces numeric ticket_id to bigint', () => {
    expect(parseAgentTicketId(9001)).toBe(9001n);
  });

  it('coerces string ticket_id to bigint', () => {
    expect(parseAgentTicketId('9001')).toBe(9001n);
  });

  it('rejects invalid ticket_id values', () => {
    expect(() => parseAgentTicketId('abc')).toThrow('ticket_id inválido');
    expect(() => parseAgentTicketId(-1)).toThrow('ticket_id inválido');
  });
});

describe('MCP ticket JSON safety', () => {
  it('get_ticket response envelope JSON.stringify does not throw', () => {
    const ticket = mapAgentTicketDetail({
      id: 9010n,
      client_id: 1,
      client_name: 'Fixture Client',
      ticket_date: new Date('2026-01-01T00:00:00.000Z'),
      total: '10.00',
      paid: '0.00',
      finished: false,
      company_id: 1,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      services_tickets: [],
    });

    expect(() => JSON.stringify({ ticket }, null, 2)).not.toThrow();
  });

  it('not-found error envelope JSON.stringify does not throw', () => {
    const envelope = { error: 'Ticket no encontrado' };
    expect(() => JSON.stringify(envelope)).not.toThrow();
    expect(envelope).toEqual({ error: 'Ticket no encontrado' });
  });
});
