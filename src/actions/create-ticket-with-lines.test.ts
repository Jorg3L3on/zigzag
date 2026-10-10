import { createTicketWithLines } from '@/actions/tickets';
import { db } from '@/lib/db';
import { AuthorizationError } from '@/lib/errors';
import { recordTicketAudit } from '@/lib/ticket-audit';
import { syncTicketTotal } from '@/lib/ticket-financials';
import { requireTicketWrite } from '@/lib/tickets-rbac-server';

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      client: {
        findFirst: jest.fn(),
      },
    },
    select: jest.fn(),
    transaction: jest.fn(),
    execute: jest.fn(),
  },
}));

jest.mock('@/lib/tickets-rbac-server', () => ({
  requireTicketRead: jest.fn(),
  requireTicketWrite: jest.fn(),
  requireTenantTicketRead: jest.fn(),
}));

jest.mock('@/lib/ticket-audit', () => ({
  recordTicketAudit: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/cache', () => ({
  invalidateCompanyCache: jest.fn(),
}));

jest.mock('@/lib/company-production-guard', () => ({
  assertCompanyProductionReady: jest.fn(),
  CompanyProductionBlockedError: class CompanyProductionBlockedError extends Error {},
}));

jest.mock('@/lib/ticket-financials', () => ({
  ...jest.requireActual('@/lib/ticket-financials'),
  syncTicketTotal: jest.fn(),
}));

const mockDb = db as unknown as {
  query: { client: { findFirst: jest.Mock } };
  select: jest.Mock;
  transaction: jest.Mock;
  execute: jest.Mock;
};

const mockRequireTicketWrite = requireTicketWrite as jest.MockedFunction<
  typeof requireTicketWrite
>;
const mockRecordTicketAudit = recordTicketAudit as jest.MockedFunction<
  typeof recordTicketAudit
>;
const mockSyncTicketTotal = syncTicketTotal as jest.MockedFunction<
  typeof syncTicketTotal
>;

const authContext = {
  userId: '1',
  companyId: 10,
  companyIsSystem: false,
};

const clientRow = {
  id: 5,
  name: 'Cliente Demo',
  phone: '5550001111',
  email: 'demo@example.com',
  document: null,
};

/** db.select().from().where() → rows for assertServicesBelongToCompany. */
const mockServiceRows = (rows: Array<{ id: number }>) => {
  mockDb.select.mockReturnValue({
    from: jest.fn(() => ({
      where: jest.fn(async () => rows),
    })),
  });
};

type Captured = {
  ticketValues?: Record<string, unknown>;
  lineValues?: Array<Record<string, unknown>>;
};

const mockTransaction = (captured: Captured) => {
  mockDb.transaction.mockImplementation(async (callback) => {
    const tx = {
      insert: jest
        .fn()
        .mockReturnValueOnce({
          values: jest.fn((values: Record<string, unknown>) => {
            captured.ticketValues = values;
            return {
              returning: jest.fn(async () => [{ id: 1201n, ...values }]),
            };
          }),
        })
        .mockReturnValueOnce({
          values: jest.fn((values: Array<Record<string, unknown>>) => {
            captured.lineValues = values;
            return {
              returning: jest.fn(async () =>
                values.map((line, index) => ({ id: 900 + index, ...line })),
              ),
            };
          }),
        }),
    };
    return callback(tx);
  });
};

const validInput = {
  company_id: 10,
  client_id: 5,
  ticket_date: new Date('2026-10-08T12:00:00Z'),
  work_notes: '  Cambio de capacitor  ',
  lines: [
    { service_id: 7, quantity: 3, price: 4200 },
    { service_id: 8, quantity: 1, price: 350.005 },
  ],
  client_total: 1,
};

describe('createTicketWithLines', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRequireTicketWrite.mockResolvedValue({
      context: authContext,
      companyId: 10,
    });
    mockRecordTicketAudit.mockResolvedValue(undefined);
    mockDb.query.client.findFirst.mockResolvedValue(clientRow);
    mockServiceRows([{ id: 7 }, { id: 8 }]);
    mockSyncTicketTotal.mockResolvedValue(12950.01);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('creates the ticket and all lines in one transaction', async () => {
    const captured: Captured = {};
    mockTransaction(captured);

    const result = await createTicketWithLines(validInput);

    expect(result).toEqual({
      success: true,
      data: { id: '1201', total: 12950.01 },
    });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(mockRequireTicketWrite).toHaveBeenCalledWith(10);
    expect(captured.ticketValues).toMatchObject({
      client_id: 5,
      client_name: 'Cliente Demo',
      client_tel: '5550001111',
      email: 'demo@example.com',
      work_notes: 'Cambio de capacitor',
      company_id: 10,
      document_kind: 'ticket',
      finished: false,
      total: 0,
      paid: 0,
    });
    expect(captured.lineValues).toEqual([
      { ticket_id: 1201n, service_id: 7, quantity: 3, price: 4200 },
      { ticket_id: 1201n, service_id: 8, quantity: 1, price: 350.01 },
    ]);
  });

  it('uses the server-synced total, not the client total', async () => {
    mockTransaction({});

    const result = await createTicketWithLines(validInput);

    expect(mockSyncTicketTotal).toHaveBeenCalledWith(expect.anything(), 1201n);
    expect(result.data?.total).toBe(12950.01);
    const auditPayload = mockRecordTicketAudit.mock.calls[0][5];
    expect(auditPayload).toMatchObject({
      source: 'composer',
      syncedTotal: 12950.01,
      ignoredClientTotal: 1,
    });
  });

  it('writes a created audit event with the lines', async () => {
    mockTransaction({});

    await createTicketWithLines(validInput);

    expect(mockRecordTicketAudit).toHaveBeenCalledTimes(1);
    const [, context, ticketId, companyId, eventType, payload] =
      mockRecordTicketAudit.mock.calls[0];
    expect(context).toBe(authContext);
    expect(ticketId).toBe(1201n);
    expect(companyId).toBe(10);
    expect(eventType).toBe('created');
    expect((payload as { lines: unknown[] }).lines).toHaveLength(2);
  });

  it('saves an inline line without touching the catalog (ZIG-I5)', async () => {
    const captured: Captured = {};
    mockTransaction(captured);
    mockServiceRows([{ id: 7 }]);

    const result = await createTicketWithLines({
      ...validInput,
      lines: [
        { service_id: 7, quantity: 1, price: 4200 },
        { kind: 'custom', name: 'Cambio de capacitor', quantity: 1, price: 850 },
      ],
    });

    expect(result.success).toBe(true);
    expect(captured.lineValues).toEqual([
      { ticket_id: 1201n, service_id: 7, quantity: 1, price: 4200 },
      {
        ticket_id: 1201n,
        service_id: null,
        name: 'Cambio de capacitor',
        description: null,
        quantity: 1,
        price: 850,
      },
    ]);
  });

  it('rejects an inline line without a name', async () => {
    const result = await createTicketWithLines({
      ...validInput,
      lines: [{ kind: 'custom', name: '  ', quantity: 1, price: 850 }],
    });

    expect(result.success).toBe(false);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('rejects a client from another tenant before writing anything', async () => {
    mockDb.query.client.findFirst.mockResolvedValue(undefined);

    const result = await createTicketWithLines(validInput);

    expect(result.success).toBe(false);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('rejects services that do not belong to the tenant', async () => {
    mockServiceRows([{ id: 7 }]);

    const result = await createTicketWithLines(validInput);

    expect(result.success).toBe(false);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['zero quantity', { service_id: 7, quantity: 0, price: 10 }],
    ['fractional quantity', { service_id: 7, quantity: 1.5, price: 10 }],
    ['negative price', { service_id: 7, quantity: 1, price: -1 }],
    ['infinite price', { service_id: 7, quantity: 1, price: Infinity }],
  ])('rejects invalid lines (%s)', async (_label, line) => {
    const result = await createTicketWithLines({ ...validInput, lines: [line] });

    expect(result.success).toBe(false);
    expect(result.errorType).toBe('validation');
    expect(mockRequireTicketWrite).not.toHaveBeenCalled();
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('requires at least one line', async () => {
    const result = await createTicketWithLines({ ...validInput, lines: [] });

    expect(result.success).toBe(false);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('does not persist anything when the permission check fails', async () => {
    mockRequireTicketWrite.mockRejectedValue(
      new AuthorizationError('No tienes permiso'),
    );

    const result = await createTicketWithLines(validInput);

    expect(result.success).toBe(false);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('drops a client email that does not fit the ticket column', async () => {
    const captured: Captured = {};
    mockTransaction(captured);
    mockDb.query.client.findFirst.mockResolvedValue({
      ...clientRow,
      email: `${'x'.repeat(45)}@example.com`,
    });

    await createTicketWithLines(validInput);

    expect(captured.ticketValues?.email).toBeNull();
  });
  it('refuses a total above the Ticket.total cap before touching the database (ZIG-I12)', async () => {
    const result = await createTicketWithLines({
      ...validInput,
      lines: [{ service_id: 7, quantity: 9999, price: 99_999_999.99 }],
    });

    expect(result).toMatchObject({
      success: false,
      errorCode: 'TC011',
      errorType: 'validation',
    });
    expect(result.error).toContain('$9,999,999,999.99');
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('saves the documented maximum price without phantom cents (ZIG-I12)', async () => {
    const captured: Captured = {};
    mockServiceRows([{ id: 7 }]);
    mockTransaction(captured);

    const result = await createTicketWithLines({
      ...validInput,
      lines: [{ service_id: 7, quantity: 1, price: 99_999_999.99 }],
    });

    expect(result.success).toBe(true);
    expect(captured.lineValues).toEqual([
      { ticket_id: 1201n, service_id: 7, quantity: 1, price: 99_999_999.99 },
    ]);
  });
});
