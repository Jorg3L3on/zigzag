import {
  createServiceTicket,
  deleteServiceTicket,
  getTicketServices,
  updateServiceTicket,
} from '@/actions/ticket-services';
import { invalidateCompanyCache } from '@/lib/cache';
import { db } from '@/lib/db';
import { requireTenantActionPermission } from '@/lib/security';
import { recordTicketAudit } from '@/lib/ticket-audit';
import {
  IDOR_RESOURCES_A,
  mockActionCrossTenantDenied,
} from '@/test/cross-tenant-action-helpers';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/ticket-audit', () => ({
  recordTicketAudit: jest.fn(async () => undefined),
}));

jest.mock('@/lib/cache', () => ({
  invalidateCompanyCache: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      ticket: {
        findFirst: jest.fn(),
      },
      service: {
        findFirst: jest.fn(),
      },
      servicesTickets: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    },
    transaction: jest.fn(),
  },
}));

jest.mock('@/lib/security', () => ({
  requireTenantActionPermission: jest.fn(),
}));

jest.mock('@/lib/ticket-financials', () => ({
  syncTicketTotal: jest.fn(async () => 100),
}));

const mockDb = db as unknown as {
  query: {
    ticket: {
      findFirst: jest.Mock;
    };
    service: {
      findFirst: jest.Mock;
    };
    servicesTickets: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };
  transaction: jest.Mock;
};

const mockRequireTenantActionPermission =
  requireTenantActionPermission as jest.MockedFunction<
    typeof requireTenantActionPermission
  >;

describe('ticket-services actions', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRequireTenantActionPermission.mockResolvedValue({
      context: { userId: '1', companyId: 10, companyIsSystem: false },
      companyId: 10,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns service lines for an in-scope ticket', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({
      id: 42n,
      company_id: 10,
      deleted_at: null,
    });
    mockDb.query.servicesTickets.findMany.mockResolvedValue([
      {
        id: 1,
        service_id: 5,
        quantity: 2,
        price: 50,
        service: { id: 5, name: 'Lavado' },
      },
    ]);

    const result = await getTicketServices('42');

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(mockRequireTenantActionPermission).toHaveBeenCalledWith(
      'tickets.read',
      undefined,
    );
  });

  it('denies access when the ticket belongs to another company', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({
      id: 42n,
      company_id: 99,
      deleted_at: null,
    });

    const result = await getTicketServices('42');

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TS001');
    expect(mockDb.query.servicesTickets.findMany).not.toHaveBeenCalled();
  });
});

describe('cross-tenant IDOR — ticket-services actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    [
      'getTicketServices',
      () => getTicketServices(String(IDOR_RESOURCES_A.ticketId)),
    ],
    [
      'createServiceTicket',
      () =>
        createServiceTicket(String(IDOR_RESOURCES_A.ticketId), {
          service_id: IDOR_RESOURCES_A.serviceId,
          quantity: 1,
          price: 100,
        }),
    ],
    [
      'updateServiceTicket',
      () =>
        updateServiceTicket(
          String(IDOR_RESOURCES_A.ticketId),
          IDOR_RESOURCES_A.serviceId,
          { quantity: 2, price: 50 },
        ),
    ],
    [
      'deleteServiceTicket',
      () =>
        deleteServiceTicket(
          String(IDOR_RESOURCES_A.ticketId),
          IDOR_RESOURCES_A.serviceId,
        ),
    ],
  ])('%s denies cross-tenant company context', async (_name, call) => {
    mockActionCrossTenantDenied(mockRequireTenantActionPermission as unknown as jest.Mock);

    const result = await call();

    expect(result.success).toBe(false);
    expect(mockRequireTenantActionPermission).toHaveBeenCalled();
  });
});

describe('ticket-services money validation (TCI-02)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRequireTenantActionPermission.mockResolvedValue({
      context: { userId: '1', companyId: 10, companyIsSystem: false },
      companyId: 10,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['zero quantity', { service_id: 5, quantity: 0, price: 10 }],
    ['negative quantity', { service_id: 5, quantity: -1, price: 10 }],
    ['negative price', { service_id: 5, quantity: 1, price: -5 }],
    ['NaN price', { service_id: 5, quantity: 1, price: Number.NaN }],
    ['infinite quantity', { service_id: 5, quantity: Number.POSITIVE_INFINITY, price: 10 }],
  ])('createServiceTicket rejects %s', async (_label, payload) => {
    const result = await createServiceTicket('42', payload);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TS006');
    expect(result.errorType).toBe('validation');
    expect(mockRequireTenantActionPermission).not.toHaveBeenCalled();
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('updateServiceTicket rejects zero quantity', async () => {
    const result = await updateServiceTicket('42', 1, {
      quantity: 0,
      price: 10,
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TS006');
    expect(result.errorType).toBe('validation');
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('createServiceTicket accepts a valid line and syncs total', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({
      id: 42n,
      company_id: 10,
      total: 100,
      paid: 0,
      deleted_at: null,
    });
    mockDb.query.service.findFirst.mockResolvedValue({
      id: 5,
      company_id: 10,
      deleted_at: null,
    });
    const createdRow = {
      id: 9,
      service_id: 5,
      quantity: 2,
      price: 50,
      ticket_id: 42n,
    };
    mockDb.transaction.mockImplementation(async (callback) => {
      const tx = {
        insert: jest.fn(() => ({
          values: jest.fn(() => ({
            returning: jest.fn(async () => [createdRow]),
          })),
        })),
      };
      return callback(tx);
    });
    mockDb.query.servicesTickets.findFirst.mockResolvedValue({
      ...createdRow,
      service: { id: 5, name: 'Lavado' },
    });

    const result = await createServiceTicket('42', {
      service_id: 5,
      quantity: 2,
      price: 50,
    });

    expect(result.success).toBe(true);
    expect(result.data?.quantity).toBe(2);
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(recordTicketAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ userId: '1', companyId: 10 }),
      42n,
      10,
      'updated',
      expect.objectContaining({ serviceLine: 'created' }),
    );
    expect(invalidateCompanyCache).toHaveBeenCalledWith(10, 'dashboard');
  });

  it('createServiceTicket adds an inline line without a catalog lookup (ZIG-I5)', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({
      id: 42n,
      company_id: 10,
      total: 100,
      paid: 0,
      deleted_at: null,
    });
    const inserted: Array<{ values: unknown }> = [];
    mockDb.transaction.mockImplementation(async (callback) => {
      const tx = {
        insert: jest.fn(() => ({
          values: jest.fn((values: Record<string, unknown>) => {
            inserted.push({ values });
            return {
              returning: jest.fn(async () => [{ id: 11, ...values }]),
            };
          }),
        })),
      };
      return callback(tx);
    });
    mockDb.query.servicesTickets.findFirst.mockResolvedValue({
      id: 11,
      service_id: null,
      name: 'Cambio de capacitor',
      quantity: 1,
      price: 850,
      service: null,
    });

    const result = await createServiceTicket('42', {
      kind: 'custom',
      name: 'Cambio de capacitor',
      quantity: 1,
      price: 850,
    });

    expect(result.success).toBe(true);
    expect(mockDb.query.service.findFirst).not.toHaveBeenCalled();
    expect(inserted).toEqual([
      {
        values: {
          ticket_id: 42n,
          service_id: null,
          name: 'Cambio de capacitor',
          description: null,
          quantity: 1,
          price: 850,
        },
      },
    ]);
    expect(recordTicketAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      42n,
      10,
      'updated',
      expect.objectContaining({
        serviceName: 'Cambio de capacitor',
        inline: true,
        savedToCatalog: false,
      }),
    );
  });

  it('createServiceTicket with Guardar en mi catálogo creates the Service in the same tx', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({
      id: 42n,
      company_id: 10,
      total: 100,
      paid: 0,
      deleted_at: null,
    });
    const inserted: unknown[] = [];
    mockDb.transaction.mockImplementation(async (callback) => {
      const tx = {
        insert: jest.fn(() => ({
          values: jest.fn((values: Record<string, unknown>) => {
            inserted.push(values);
            return {
              returning: jest.fn(async () =>
                'company_id' in values ? [{ id: 77 }] : [{ id: 12, ...values }],
              ),
            };
          }),
        })),
      };
      return callback(tx);
    });
    mockDb.query.servicesTickets.findFirst.mockResolvedValue({
      id: 12,
      service_id: 77,
      quantity: 1,
      price: 3500,
      service: { id: 77, name: 'Instalación' },
    });

    const result = await createServiceTicket('42', {
      kind: 'custom',
      name: 'Instalación',
      save_to_catalog: true,
      quantity: 1,
      price: 3500,
    });

    expect(result.success).toBe(true);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    expect(inserted).toEqual([
      { company_id: 10, name: 'Instalación', description: 'Instalación', price: 3500 },
      { ticket_id: 42n, service_id: 77, quantity: 1, price: 3500 },
    ]);
  });

  it('createServiceTicket rejects an inline line without a name', async () => {
    const result = await createServiceTicket('42', {
      kind: 'custom',
      name: '',
      quantity: 1,
      price: 10,
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TS006');
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('rejects service mutations on saldado tickets', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({
      id: 42n,
      company_id: 10,
      total: 100,
      paid: 100,
      deleted_at: null,
    });

    const createResult = await createServiceTicket('42', {
      service_id: 5,
      quantity: 1,
      price: 10,
    });
    const updateResult = await updateServiceTicket('42', 1, {
      quantity: 2,
      price: 10,
    });
    const deleteResult = await deleteServiceTicket('42', 1);

    expect(createResult.success).toBe(false);
    expect(createResult.errorCode).toBe('TC010');
    expect(updateResult.success).toBe(false);
    expect(updateResult.errorCode).toBe('TC010');
    expect(deleteResult.success).toBe(false);
    expect(deleteResult.errorCode).toBe('TC010');
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });
});

describe('ticket-services line materials (ZIG-I10)', () => {
  type Write = { kind: 'insert' | 'update'; table: unknown; values: unknown };

  const makeTx = (selectResults: unknown[][]) => {
    const writes: Write[] = [];
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => {
            const rows = selectResults.shift() ?? [];
            return Object.assign(Promise.resolve(rows), {
              limit: jest.fn(async () => rows),
            });
          }),
        })),
      })),
      insert: jest.fn((table: unknown) => ({
        values: jest.fn((values: unknown) => {
          writes.push({ kind: 'insert', table, values });
          return {
            returning: jest.fn(async () =>
              Array.isArray(values)
                ? values.map((row, index) => ({ id: 600 + index, ...row }))
                : [{ id: 31, ...(values as object) }],
            ),
          };
        }),
      })),
      update: jest.fn((table: unknown) => ({
        set: jest.fn((values: unknown) => {
          writes.push({ kind: 'update', table, values });
          return {
            where: jest.fn(() =>
              Object.assign(Promise.resolve(), {
                returning: jest.fn(async () => [
                  { id: 31, ticket_id: 42n, service_id: 5, quantity: 1, price: 900 },
                ]),
              }),
            ),
          };
        }),
      })),
    };
    mockDb.transaction.mockImplementation(async (callback) => callback(tx));
    return writes;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRequireTenantActionPermission.mockResolvedValue({
      context: { userId: '1', companyId: 10, companyIsSystem: false },
      companyId: 10,
    });
    mockDb.query.ticket.findFirst.mockResolvedValue({
      id: 42n,
      company_id: 10,
      total: 100,
      paid: 0,
      deleted_at: null,
    });
    mockDb.query.service.findFirst.mockResolvedValue({ id: 5, name: 'Carga de gas' });
    mockDb.query.servicesTickets.findFirst.mockResolvedValue({ id: 31, materials: [] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('createServiceTicket inserts the line materials and audits them', async () => {
    const writes = makeTx([[{ id: 9, name: 'Gas R410A', unit: 'kg', price: 380 }]]);

    const result = await createServiceTicket('42', {
      service_id: 5,
      quantity: 1,
      price: 900,
      materials: [{ material_id: 9, quantity: 1.5, price: 380 }],
    });

    expect(result.success).toBe(true);
    const materialInsert = writes.find(
      (write) => write.kind === 'insert' && Array.isArray(write.values),
    );
    expect(materialInsert?.values).toEqual([
      {
        services_tickets_id: 31,
        material_id: 9,
        name: 'Gas R410A',
        unit: 'kg',
        quantity: 1.5,
        price: 380,
        sort_order: 0,
      },
    ]);
    expect(recordTicketAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      42n,
      10,
      'updated',
      expect.objectContaining({
        serviceLine: 'created',
        materials: [expect.objectContaining({ name: 'Gas R410A' })],
      }),
    );
  });

  it('createServiceTicket rejects a catalog material of another company (IDOR)', async () => {
    const writes = makeTx([[]]);

    const result = await createServiceTicket('42', {
      service_id: 5,
      quantity: 1,
      price: 900,
      materials: [{ material_id: 999, quantity: 1, price: 1 }],
    });

    expect(result.success).toBe(false);
    expect(
      writes.some((write) => write.kind === 'insert' && Array.isArray(write.values)),
    ).toBe(false);
  });

  it('updateServiceTicket replaces the material set and audits before/after', async () => {
    const before = [
      { id: 70, services_tickets_id: 31, material_id: null, name: 'Cinta', quantity: 1, price: 40 },
    ];
    // retireLineMaterials → before rows; no catalog ids to load.
    const writes = makeTx([before]);

    const result = await updateServiceTicket('42', 31, {
      quantity: 1,
      price: 900,
      materials: [{ kind: 'custom', name: 'Tubo', unit: 'm', quantity: 2, price: 85 }],
    });

    expect(result.success).toBe(true);
    expect(writes.map((write) => write.kind)).toEqual(['update', 'update', 'insert']);
    expect(recordTicketAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      42n,
      10,
      'updated',
      expect.objectContaining({
        serviceLine: 'updated',
        materials: {
          before,
          after: [expect.objectContaining({ name: 'Tubo', quantity: 2, price: 85 })],
        },
      }),
    );
  });

  it('updateServiceTicket without materials leaves them untouched', async () => {
    const writes = makeTx([]);

    const result = await updateServiceTicket('42', 31, { quantity: 2, price: 900 });

    expect(result.success).toBe(true);
    expect(writes.map((write) => write.kind)).toEqual(['update']);
  });
});
