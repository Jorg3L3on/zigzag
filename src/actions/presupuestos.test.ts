import {
  convertPresupuestoToTicket,
  createPresupuestoWithLines,
} from '@/actions/presupuestos';
import { service, servicesTickets, ticket } from '@/db/schema';
import { db } from '@/lib/db';
import { recordTicketAudit } from '@/lib/ticket-audit';
import { requireTicketWrite } from '@/lib/tickets-rbac-server';

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      ticket: { findFirst: jest.fn() },
      client: { findFirst: jest.fn() },
      service: { findMany: jest.fn() },
    },
    transaction: jest.fn(),
  },
}));

jest.mock('@/lib/tickets-rbac-server', () => ({
  requireTicketRead: jest.fn(),
  requireTicketWrite: jest.fn(),
}));

jest.mock('@/lib/ticket-audit', () => ({
  recordTicketAudit: jest.fn(async () => undefined),
}));

jest.mock('@/lib/cache', () => ({
  invalidateCompanyCache: jest.fn(),
}));

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

jest.mock('@/lib/ticket-financials', () => ({
  ...jest.requireActual('@/lib/ticket-financials'),
  syncTicketTotal: jest.fn(async () => 5050),
}));

jest.mock('@/lib/company-production-guard', () => ({
  assertCompanyProductionReady: jest.fn(),
  CompanyProductionBlockedError: class CompanyProductionBlockedError extends Error {},
}));

const mockDb = db as unknown as {
  query: {
    ticket: { findFirst: jest.Mock };
    client: { findFirst: jest.Mock };
    service: { findMany: jest.Mock };
  };
  transaction: jest.Mock;
};

const authContext = { userId: '1', companyId: 10, companyIsSystem: false };

const quote = {
  id: 300n,
  company_id: 10,
  document_kind: 'presupuesto',
  client_id: 5,
  client_name: 'Plaza Comercial Aurora',
  client_tel: '5550001111',
  email: null,
  document: null,
  ticket_date: new Date('2026-10-09T12:00:00Z'),
  expires_at: null,
  canceled_at: null,
  converted_to_ticket_id: null,
  total: 5050,
  deleted_at: null,
  services_tickets: [
    { id: 1, service_id: 7, name: null, description: null, quantity: 1, price: 4200 },
    {
      id: 2,
      service_id: null,
      name: 'Cambio de capacitor',
      description: '35 µF',
      quantity: 1,
      price: 850,
    },
  ],
};

describe('convertPresupuestoToTicket (ZIG-I5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireTicketWrite as jest.Mock).mockResolvedValue({
      context: authContext,
      companyId: 10,
    });
  });

  it('copies catalog and inline lines verbatim onto the new ticket', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue(quote);
    const lineInserts: unknown[] = [];
    mockDb.transaction.mockImplementation(async (callback) => {
      const tx = {
        insert: jest.fn((table: unknown) => ({
          values: jest.fn((values: unknown) => {
            if (table === servicesTickets) {
              lineInserts.push(values);
              return Promise.resolve();
            }
            expect(table).toBe(ticket);
            return {
              returning: jest.fn(async () => [{ id: 301n, ...(values as object) }]),
            };
          }),
        })),
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(() => ({
              returning: jest.fn(async () => [
                { ...quote, converted_to_ticket_id: 301n },
              ]),
            })),
          })),
        })),
      };
      return callback(tx);
    });

    const result = await convertPresupuestoToTicket(300, 10);

    expect(result.success).toBe(true);
    expect(result.data?.ticketId).toBe('301');
    expect(lineInserts).toEqual([
      [
        {
          ticket_id: 301n,
          service_id: 7,
          name: null,
          description: null,
          quantity: 1,
          price: 4200,
        },
        {
          ticket_id: 301n,
          service_id: null,
          name: 'Cambio de capacitor',
          description: '35 µF',
          quantity: 1,
          price: 850,
        },
      ],
    ]);
    expect(recordTicketAudit).toHaveBeenCalledWith(
      expect.anything(),
      authContext,
      300n,
      10,
      'presupuesto_converted',
      expect.objectContaining({ targetTicketId: '301' }),
    );
  });

  it('refuses a work ticket id', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({
      ...quote,
      document_kind: 'ticket',
    });

    const result = await convertPresupuestoToTicket(300, 10);

    expect(result.success).toBe(false);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });
});

describe('createPresupuestoWithLines (ZIG-I5-3)', () => {
  const clientRow = {
    id: 5,
    name: 'Plaza Comercial Aurora',
    phone: '5550001111',
    email: 'compras@aurora.demo',
    document: null,
  };
  const validInput = {
    company_id: 10,
    client_id: 5,
    ticket_date: new Date('2026-10-09T12:00:00Z'),
    expires_at: new Date('2026-10-24T00:00:00Z'),
    work_notes: '  Incluye material  ',
    lines: [
      { service_id: 7, quantity: 1, price: 4200 },
      { kind: 'custom' as const, name: 'Cambio de capacitor', quantity: 1, price: 850 },
    ],
    client_total: 1,
  };

  type Inserted = { table: unknown; values: unknown };

  const mockTx = (inserted: Inserted[]) => {
    mockDb.transaction.mockImplementation(async (callback) => {
      let serviceId = 90;
      const tx = {
        insert: jest.fn((table: unknown) => ({
          values: jest.fn((values: unknown) => {
            inserted.push({ table, values });
            return {
              returning: jest.fn(async () => {
                if (table === ticket) return [{ id: 400n, ...(values as object) }];
                if (table === service) {
                  serviceId += 1;
                  return [{ id: serviceId }];
                }
                return (values as object[]).map((row, index) => ({ id: index + 1, ...row }));
              }),
            };
          }),
        })),
      };
      return callback(tx);
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (requireTicketWrite as jest.Mock).mockResolvedValue({
      context: authContext,
      companyId: 10,
    });
    mockDb.query.client.findFirst.mockResolvedValue(clientRow);
    mockDb.query.service.findMany.mockResolvedValue([{ id: 7 }]);
  });

  it('creates the quote and its catalog + inline lines in one transaction', async () => {
    const inserted: Inserted[] = [];
    mockTx(inserted);

    const result = await createPresupuestoWithLines(validInput);

    expect(result).toEqual({ success: true, data: { id: '400', total: 5050 } });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(inserted[0].table).toBe(ticket);
    expect(inserted[0].values).toMatchObject({
      client_id: 5,
      client_name: 'Plaza Comercial Aurora',
      client_tel: '5550001111',
      email: 'compras@aurora.demo',
      document_kind: 'presupuesto',
      expires_at: validInput.expires_at,
      work_notes: 'Incluye material',
      company_id: 10,
      finished: false,
      paid: 0,
      total: 0,
    });
    expect(inserted[1]).toEqual({
      table: servicesTickets,
      values: [
        { ticket_id: 400n, service_id: 7, quantity: 1, price: 4200 },
        {
          ticket_id: 400n,
          service_id: null,
          name: 'Cambio de capacitor',
          description: null,
          quantity: 1,
          price: 850,
        },
      ],
    });
  });

  it('writes a created audit event with document_kind presupuesto and the server total', async () => {
    mockTx([]);

    await createPresupuestoWithLines(validInput);

    expect(recordTicketAudit).toHaveBeenCalledWith(
      expect.anything(),
      authContext,
      400n,
      10,
      'created',
      expect.objectContaining({
        document_kind: 'presupuesto',
        source: 'composer',
        syncedTotal: 5050,
        ignoredClientTotal: 1,
      }),
    );
  });

  it('saves an inline line to the catalog in the same transaction when asked', async () => {
    const inserted: Inserted[] = [];
    mockTx(inserted);

    await createPresupuestoWithLines({
      ...validInput,
      lines: [
        {
          kind: 'custom',
          name: 'Instalación',
          save_to_catalog: true,
          quantity: 1,
          price: 3500,
        },
      ],
    });

    expect(inserted.map((entry) => entry.table)).toEqual([ticket, service, servicesTickets]);
    expect(inserted[2].values).toEqual([
      { ticket_id: 400n, service_id: 91, quantity: 1, price: 3500 },
    ]);
  });

  it('accepts a quote without Vence', async () => {
    const inserted: Inserted[] = [];
    mockTx(inserted);

    const result = await createPresupuestoWithLines({ ...validInput, expires_at: null });

    expect(result.success).toBe(true);
    expect(inserted[0].values).toMatchObject({ expires_at: null });
  });

  it('rejects a client from another tenant before writing anything', async () => {
    mockDb.query.client.findFirst.mockResolvedValue(undefined);

    const result = await createPresupuestoWithLines(validInput);

    expect(result.success).toBe(false);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('rejects a catalog service from another tenant', async () => {
    mockDb.query.service.findMany.mockResolvedValue([{ id: 8 }]);

    const result = await createPresupuestoWithLines(validInput);

    expect(result.success).toBe(false);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['no lines', { lines: [] }],
    ['Vence before the date', { expires_at: new Date('2026-10-01T00:00:00Z') }],
    ['inline line without name', { lines: [{ kind: 'custom', name: ' ', quantity: 1, price: 1 }] }],
    ['fractional quantity', { lines: [{ service_id: 7, quantity: 1.5, price: 1 }] }],
  ])('rejects %s', async (_label, patch) => {
    const result = await createPresupuestoWithLines({
      ...validInput,
      ...(patch as object),
    } as never);

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('validation');
    expect(requireTicketWrite).not.toHaveBeenCalled();
  });
});
