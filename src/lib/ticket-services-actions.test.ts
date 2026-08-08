import {
  createServiceTicket,
  deleteServiceTicket,
  getTicketServices,
  updateServiceTicket,
} from '@/actions/ticket-services';
import { invalidateCompanyCache } from '@/lib/cache';
import { db } from '@/lib/db';
import { requireActionPermission } from '@/lib/security';
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
  requireActionPermission: jest.fn(),
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

const mockRequireActionPermission =
  requireActionPermission as jest.MockedFunction<typeof requireActionPermission>;

describe('ticket-services actions', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRequireActionPermission.mockResolvedValue({
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
    expect(mockRequireActionPermission).toHaveBeenCalledWith('tickets.read');
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
    mockActionCrossTenantDenied(mockRequireActionPermission as unknown as jest.Mock);

    const result = await call();

    expect(result.success).toBe(false);
    expect(mockRequireActionPermission).toHaveBeenCalled();
  });
});

describe('ticket-services money validation (TCI-02)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRequireActionPermission.mockResolvedValue({
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
    expect(mockRequireActionPermission).not.toHaveBeenCalled();
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
