import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import {
  convertPresupuestoToTicket,
  createPresupuestoWithLines,
  getPresupuestoById,
  updatePresupuesto,
} from '@/actions/presupuestos';
import { service, servicesTickets, ticket, ticketLineMaterial } from '@/db/schema';
import { db } from '@/lib/db';
import { recordTicketAudit } from '@/lib/ticket-audit';
import { requireTicketRead, requireTicketWrite } from '@/lib/tickets-rbac-server';

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
      materials: [
        {
          id: 70,
          services_tickets_id: 2,
          material_id: 12,
          name: 'Capacitor 35 µF',
          unit: 'pza',
          quantity: 1,
          price: 320,
          sort_order: 0,
        },
        {
          id: 71,
          services_tickets_id: 2,
          material_id: null,
          name: 'Cinta aislante',
          unit: null,
          quantity: 0.5,
          price: 60,
          sort_order: 1,
        },
      ],
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

  it('copies catalog and inline lines and their materials verbatim onto the new ticket', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue(quote);
    const lineInserts: unknown[] = [];
    const materialInserts: unknown[] = [];
    let nextLineId = 800;
    mockDb.transaction.mockImplementation(async (callback) => {
      const tx = {
        insert: jest.fn((table: unknown) => ({
          values: jest.fn((values: unknown) => {
            if (table === servicesTickets) {
              lineInserts.push(values);
              nextLineId += 1;
              const id = nextLineId;
              return { returning: jest.fn(async () => [{ id }]) };
            }
            if (table === ticketLineMaterial) {
              materialInserts.push(values);
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
      ],
      [
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
    // ZIG-I10: materials follow their line onto the new line id (802).
    expect(materialInserts).toEqual([
      [
        {
          services_tickets_id: 802,
          material_id: 12,
          name: 'Capacitor 35 µF',
          unit: 'pza',
          quantity: 1,
          price: 320,
          sort_order: 0,
        },
        {
          services_tickets_id: 802,
          material_id: null,
          name: 'Cinta aislante',
          unit: null,
          quantity: 0.5,
          price: 60,
          sort_order: 1,
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
                const rows = Array.isArray(values) ? values : [values];
                return rows.map((row, index) => ({ id: index + 1, ...row }));
              }),
            };
          }),
        })),
        // Catalog material lookup (ZIG-I10): company 10 owns material 12.
        select: jest.fn(() => ({
          from: jest.fn(() => ({
            where: jest.fn(async () => [
              { id: 12, name: 'Capacitor 35 µF', unit: 'pza', price: 320 },
            ]),
          })),
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

  it('refuses a total above the Ticket.total cap before touching the database (ZIG-I12)', async () => {
    const result = await createPresupuestoWithLines({
      ...validInput,
      lines: [{ service_id: 7, quantity: 9999, price: 99_999_999.99 }],
    });

    expect(result).toMatchObject({
      success: false,
      errorCode: 'TC011',
      errorType: 'validation',
    });
    expect(mockDb.transaction).not.toHaveBeenCalled();
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

  it('saves each line materials with a catalog snapshot (ZIG-I10)', async () => {
    const inserted: Inserted[] = [];
    mockTx(inserted);

    const result = await createPresupuestoWithLines({
      ...validInput,
      lines: [
        {
          kind: 'custom',
          name: 'Cambio de capacitor',
          quantity: 1,
          price: 850,
          materials: [
            { material_id: 12, quantity: 1, price: 350 },
            { kind: 'custom', name: 'Cinta', quantity: 0.5, price: 60 },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(inserted.map((entry) => entry.table)).toEqual([
      ticket,
      servicesTickets,
      ticketLineMaterial,
    ]);
    expect(inserted[2].values).toEqual([
      {
        services_tickets_id: 1,
        material_id: 12,
        name: 'Capacitor 35 µF',
        unit: 'pza',
        quantity: 1,
        price: 350,
        sort_order: 0,
      },
      {
        services_tickets_id: 1,
        material_id: null,
        name: 'Cinta',
        unit: null,
        quantity: 0.5,
        price: 60,
        sort_order: 1,
      },
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

describe('getPresupuestoById (ZIG-I5-4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireTicketRead as jest.Mock).mockResolvedValue({
      context: authContext,
      companyId: 10,
    });
  });

  it('scopes the lookup to the tenant and to document_kind presupuesto', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({ ...quote, services_tickets: [] });

    const result = await getPresupuestoById(300);

    expect(result.success).toBe(true);
    const { where } = mockDb.query.ticket.findFirst.mock.calls[0][0] as { where: SQL };
    const query = new PgDialect().sqlToQuery(where);
    expect(query.sql).toContain('"company_id" = $');
    expect(query.sql).toContain('"document_kind" = $');
    expect(query.sql).toContain('"deleted_at" is null');
    expect(query.params).toEqual(expect.arrayContaining([300n, 10, 'presupuesto']));
  });

  it('returns not found for another tenant or a work ticket id', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue(undefined);

    const result = await getPresupuestoById(300);

    expect(result.success).toBe(false);
    expect((result as { errorCode?: string }).errorCode).toBe('TC008');
  });
});

describe('updatePresupuesto (ZIG-I5-5 edit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireTicketWrite as jest.Mock).mockResolvedValue({
      context: authContext,
      companyId: 10,
    });
    mockDb.query.service.findMany.mockResolvedValue([{ id: 7 }]);
  });

  it('replaces the lines keeping inline ones inline and saves notes and Vence', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue(quote);
    const inserted: Array<{ table: unknown; values: unknown }> = [];
    const updates: unknown[] = [];
    mockDb.transaction.mockImplementation(async (callback) => {
      const tx = {
        insert: jest.fn((table: unknown) => ({
          values: jest.fn((values: unknown) => {
            inserted.push({ table, values });
            return { returning: jest.fn(async () => values as object[]) };
          }),
        })),
        update: jest.fn(() => ({
          set: jest.fn((values: unknown) => {
            updates.push(values);
            return {
              where: jest.fn(() =>
                Object.assign(Promise.resolve(), {
                  returning: jest.fn(async () => [{ ...quote, ...(values as object) }]),
                }),
              ),
            };
          }),
        })),
      };
      return callback(tx);
    });

    const expires = new Date('2026-11-08T00:00:00Z');
    const result = await updatePresupuesto(300, {
      company_id: 10,
      expires_at: expires,
      work_notes: '  Precio incluye material ',
      services: [
        { kind: 'custom', name: 'Revisión de fuga', save_to_catalog: false, quantity: 1, price: 600 },
        { service_id: 7, quantity: 2, price: 2100 },
      ],
    });

    expect(result.success).toBe(true);
    expect(inserted).toEqual([
      {
        table: servicesTickets,
        values: [
          {
            ticket_id: 300n,
            service_id: null,
            name: 'Revisión de fuga',
            description: null,
            quantity: 1,
            price: 600,
          },
          { ticket_id: 300n, service_id: 7, quantity: 2, price: 2100 },
        ],
      },
    ]);
    expect(updates[1]).toMatchObject({
      expires_at: expires,
      work_notes: 'Precio incluye material',
      total: 4800,
    });
  });

  it('refuses to edit a converted quote', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({
      ...quote,
      converted_to_ticket_id: 301n,
    });

    const result = await updatePresupuesto(300, { company_id: 10, work_notes: 'x' });

    expect(result.success).toBe(false);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });
});
