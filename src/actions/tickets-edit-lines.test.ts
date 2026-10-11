import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import { duplicateTicket, updateTicketLines } from '@/actions/tickets';
import { servicesTickets, ticket } from '@/db/schema';
import { db } from '@/lib/db';
import { insertServiceLines } from '@/lib/service-lines-server';
import { recordTicketAudit } from '@/lib/ticket-audit';
import { syncTicketTotal } from '@/lib/ticket-financials';
import { requireTicketWrite } from '@/lib/tickets-rbac-server';

jest.mock('@/lib/db', () => ({
  db: {
    query: { ticket: { findFirst: jest.fn() }, client: { findFirst: jest.fn() } },
    transaction: jest.fn(),
  },
}));
jest.mock('@/lib/tickets-rbac-server', () => ({
  requireTicketRead: jest.fn(),
  requireTicketWrite: jest.fn(),
}));
jest.mock('@/lib/ticket-audit', () => ({ recordTicketAudit: jest.fn(async () => undefined) }));
jest.mock('@/lib/cache', () => ({ invalidateCompanyCache: jest.fn() }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/ticket-financials', () => ({
  ...jest.requireActual('@/lib/ticket-financials'),
  syncTicketTotal: jest.fn(),
}));
jest.mock('@/lib/service-lines-server', () => ({
  ...jest.requireActual('@/lib/service-lines-server'),
  insertServiceLines: jest.fn(),
  assertCatalogServicesBelongToCompany: jest.fn(async () => undefined),
}));
jest.mock('@/lib/company-production-guard', () => ({
  assertCompanyProductionReady: jest.fn(),
  CompanyProductionBlockedError: class CompanyProductionBlockedError extends Error {},
}));

const mockDb = db as unknown as {
  query: { ticket: { findFirst: jest.Mock }; client: { findFirst: jest.Mock } };
  transaction: jest.Mock;
};

const authContext = { userId: '1', companyId: 10, companyIsSystem: false };

const openTicket = {
  id: 700n,
  company_id: 10,
  document_kind: 'ticket',
  client_id: 5,
  client_name: 'Plaza Aurora',
  client_tel: '5550001111',
  email: null,
  document: null,
  ticket_date: new Date('2026-10-09T12:00:00Z'),
  work_notes: null,
  total: 1000,
  paid: 0,
  finished: false,
  deleted_at: null,
  services_tickets: [],
};

const lines = [
  { service_id: 7, quantity: 2, price: 600 },
  { kind: 'custom' as const, name: 'Soporte', quantity: 1, price: 150 },
];

/** Records the writes of one transaction; `syncedTotal` is what syncTicketTotal reports. */
const mockTx = (syncedTotal: number) => {
  const updates: Array<{ table: unknown; set: Record<string, unknown> }> = [];
  mockDb.transaction.mockImplementation(async (callback) =>
    callback({
      update: jest.fn((table: unknown) => ({
        set: jest.fn((set: Record<string, unknown>) => {
          updates.push({ table, set });
          return {
            where: jest.fn(() => ({
              returning: jest.fn(async () => [{ ...openTicket, ...set }]),
              then: undefined,
            })),
          };
        }),
      })),
    }),
  );
  (syncTicketTotal as jest.Mock).mockResolvedValue(syncedTotal);
  return updates;
};

describe('updateTicketLines (ZIG-I13-6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireTicketWrite as jest.Mock).mockResolvedValue({ context: authContext, companyId: 10 });
    (insertServiceLines as jest.Mock).mockResolvedValue({
      rows: [{ id: 1 }, { id: 2 }],
      createdServiceIds: [],
      createdMaterialIds: [],
    });
    mockDb.query.ticket.findFirst.mockResolvedValue(openTicket);
  });

  it('replaces the lines and their materials in one transaction, re-syncs the total and audits before/after', async () => {
    const updates = mockTx(1350);

    const result = await updateTicketLines(700, { company_id: 10, lines, work_notes: ' Nota ' });

    expect(result).toEqual({
      success: true,
      data: { id: '700', total: 1350, previousTotal: 1000, finished: false },
    });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    // 1: soft-delete the old lines, 2: the ticket row.
    expect(updates[0].table).toBe(servicesTickets);
    expect(updates[0].set).toHaveProperty('deleted_at');
    expect(updates[1].table).toBe(ticket);
    expect(updates[1].set).toMatchObject({ work_notes: 'Nota' });
    expect(insertServiceLines).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ companyId: 10, ticketId: 700n }),
    );
    expect(syncTicketTotal).toHaveBeenCalledTimes(1);
    expect(recordTicketAudit).toHaveBeenCalledWith(
      expect.anything(),
      authContext,
      700n,
      10,
      'updated',
      expect.objectContaining({ servicesChanged: true, previousTotal: 1000, total: 1350 }),
    );
  });

  it('refuses a total below what is already paid, before writing anything', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({ ...openTicket, finished: true, paid: 500 });

    const result = await updateTicketLines(700, {
      company_id: 10,
      lines: [{ service_id: 7, quantity: 1, price: 100 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('El total no puede quedar abajo de lo ya pagado ($500.00)');
    expect(result.errorType).toBe('validation');
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('rolls back when the synced total lands below the paid amount', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({ ...openTicket, finished: true, paid: 500 });
    mockTx(400);

    const result = await updateTicketLines(700, {
      company_id: 10,
      lines: [{ service_id: 7, quantity: 1, price: 600 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('$500.00');
    expect(recordTicketAudit).not.toHaveBeenCalled();
  });

  it('refuses a ticket from another company (IDOR) without touching it', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({ ...openTicket, company_id: 99 });

    const result = await updateTicketLines(700, { company_id: 10, lines });

    expect(result.success).toBe(false);
    expect(mockDb.transaction).not.toHaveBeenCalled();
    expect(insertServiceLines).not.toHaveBeenCalled();
  });

  it('refuses a client of another company when the ticket is still En proceso', async () => {
    mockDb.query.client.findFirst.mockResolvedValue(undefined);

    const result = await updateTicketLines(700, { company_id: 10, client_id: 77, lines });

    expect(result.success).toBe(false);
    expect(mockDb.transaction).not.toHaveBeenCalled();
    const { where } = mockDb.query.client.findFirst.mock.calls[0][0] as { where: SQL };
    expect(new PgDialect().sqlToQuery(where).params).toEqual(expect.arrayContaining([77, 10]));
  });

  it('keeps the client and the date of a finalized ticket', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({ ...openTicket, finished: true, paid: 100 });
    const updates = mockTx(1350);

    const result = await updateTicketLines(700, {
      company_id: 10,
      client_id: 9,
      ticket_date: '2026-01-01',
      lines,
    });

    expect(result.success).toBe(true);
    expect(mockDb.query.client.findFirst).not.toHaveBeenCalled();
    const ticketSet = updates.find((entry) => entry.table === ticket)?.set ?? {};
    expect(ticketSet).not.toHaveProperty('client_id');
    expect(ticketSet).not.toHaveProperty('ticket_date');
  });

  it('refuses a settled ticket and a presupuesto id', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValueOnce({ ...openTicket, finished: true, total: 500, paid: 500 });
    mockDb.query.ticket.findFirst.mockResolvedValueOnce({ total: 500, paid: 500 });
    const settled = await updateTicketLines(700, { company_id: 10, lines });
    expect(settled.success).toBe(false);

    mockDb.query.ticket.findFirst.mockResolvedValue({ ...openTicket, document_kind: 'presupuesto' });
    const quote = await updateTicketLines(700, { company_id: 10, lines });
    expect(quote.success).toBe(false);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['no lines', { lines: [] }],
    ['a three-decimal quantity', { lines: [{ service_id: 7, quantity: 1.234, price: 1 }] }],
  ])('rejects %s before authorizing', async (_label, patch) => {
    const result = await updateTicketLines(700, { company_id: 10, ...(patch as object) } as never);

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('validation');
    expect(requireTicketWrite).not.toHaveBeenCalled();
  });
});

describe('duplicateTicket (ZIG-I13-6)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireTicketWrite as jest.Mock).mockResolvedValue({ context: authContext, companyId: 10 });
  });

  it('returns a draft with the lines and materials, dated today, with no payments', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({
      ...openTicket,
      paid: 400,
      finished: true,
      work_notes: 'Garantía 30 días',
      services_tickets: [
        { id: 1, service_id: 7, name: null, description: null, quantity: 2, price: 600, service: { name: 'Mantenimiento' }, materials: [] },
        {
          id: 2,
          service_id: null,
          name: 'Soporte',
          description: null,
          quantity: 1,
          price: 150,
          service: null,
          materials: [
            { id: 5, services_tickets_id: 2, material_id: null, name: 'Tornillos', unit: 'pza', quantity: 4, price: 2, sort_order: 0 },
          ],
        },
      ],
    });

    const result = await duplicateTicket(700, 10);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.client).toEqual({ id: 5, label: 'Plaza Aurora · 5550001111' });
    expect(result.data.notes).toBe('Garantía 30 días');
    expect(result.data.lines).toHaveLength(2);
    expect(result.data.lines[0]).toMatchObject({ kind: 'catalog', service_id: 7, quantity: 2, price: 600 });
    expect(result.data.lines[1]).toMatchObject({ kind: 'custom', service_name: 'Soporte' });
    expect(result.data.lines[1].materials?.[0]).toMatchObject({ name: 'Tornillos', quantity: 4, price: 2 });
    expect(new Date(result.data.ticketDate).getTime()).toBeGreaterThan(openTicket.ticket_date.getTime());
    expect(result.data).not.toHaveProperty('paid');
  });

  it("is scoped to the caller's company and to work tickets (IDOR)", async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue(undefined);

    const result = await duplicateTicket(700, 10);

    expect(result.success).toBe(false);
    const { where } = mockDb.query.ticket.findFirst.mock.calls[0][0] as { where: SQL };
    const query = new PgDialect().sqlToQuery(where);
    expect(query.sql).toContain('"company_id" = $');
    expect(query.sql).toContain('"document_kind" = $');
    expect(query.sql).toContain('"deleted_at" is null');
    expect(query.params).toEqual(expect.arrayContaining([700n, 10, 'ticket']));
  });

  it('needs write access', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue(openTicket);
    await duplicateTicket(700, 10);
    expect(requireTicketWrite).toHaveBeenCalledWith(10);
  });
});

describe('recordReceiptShared (ZIG-I13-6)', () => {
  const { requireTicketRead } = jest.requireMock('@/lib/tickets-rbac-server') as {
    requireTicketRead: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    requireTicketRead.mockResolvedValue({ context: authContext, companyId: 10 });
    mockDb.transaction.mockImplementation(async (callback) => callback({}));
  });

  it("logs the share against the caller's company only", async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({ id: 700n, total: 1350, paid: 500 });

    const { recordReceiptShared } = await import('@/actions/tickets');
    const result = await recordReceiptShared(700, 10);

    expect(result.success).toBe(true);
    expect(recordTicketAudit).toHaveBeenCalledWith(
      expect.anything(),
      authContext,
      700n,
      10,
      'receipt_shared',
      { total: 1350, paid: 500 },
    );
    const { where } = mockDb.query.ticket.findFirst.mock.calls[0][0] as { where: SQL };
    const query = new PgDialect().sqlToQuery(where);
    expect(query.sql).toContain('"company_id" = $');
    expect(query.params).toEqual(expect.arrayContaining([700n, 10, 'ticket']));
  });

  it('logs nothing for a ticket that is not in the company', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue(undefined);

    const { recordReceiptShared } = await import('@/actions/tickets');
    const result = await recordReceiptShared(700, 10);

    expect(result.success).toBe(false);
    expect(recordTicketAudit).not.toHaveBeenCalled();
  });
});
