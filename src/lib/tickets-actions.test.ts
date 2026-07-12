import {
  applyTicketPayment,
  createTicket,
  deleteTicket,
  finishTicket,
  getTicketAuditHistory,
  getTicketById,
  getTickets,
  updateTicket,
} from '@/actions/tickets';
import { db } from '@/lib/db';
import { AuthorizationError } from '@/lib/errors';
import { recordTicketAudit } from '@/lib/ticket-audit';
import {
  requireTicketRead,
  requireTicketWrite,
} from '@/lib/tickets-rbac-server';
import { IDOR_COMPANY_A, IDOR_RESOURCES_A } from '@/test/idor-fixtures';

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      ticket: {
        findFirst: jest.fn(),
      },
    },
    transaction: jest.fn(),
  },
}));

jest.mock('@/lib/tickets-rbac-server', () => ({
  requireTicketRead: jest.fn(),
  requireTicketWrite: jest.fn(),
}));

jest.mock('@/lib/ticket-audit', () => ({
  recordTicketAudit: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/company-production-guard', () => ({
  assertCompanyProductionReady: jest.fn(),
  CompanyProductionBlockedError: class CompanyProductionBlockedError extends Error {},
}));

const mockDb = db as unknown as {
  query: {
    ticket: {
      findFirst: jest.Mock;
    };
  };
  transaction: jest.Mock;
};

const mockRequireTicketWrite = requireTicketWrite as jest.MockedFunction<
  typeof requireTicketWrite
>;
const mockRequireTicketRead = requireTicketRead as jest.MockedFunction<
  typeof requireTicketRead
>;
const mockRecordTicketAudit = recordTicketAudit as jest.MockedFunction<
  typeof recordTicketAudit
>;

const authContext = {
  userId: '1',
  companyId: 10,
  companyIsSystem: false,
};

const writableTicket = {
  id: 42n,
  company_id: 10,
  finished: true,
  total: 100,
  paid: 40,
  deleted_at: null,
};

describe('ticket actions — payments', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRequireTicketWrite.mockResolvedValue({
      context: authContext,
      companyId: 10,
    });
    mockRecordTicketAudit.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('applyTicketPayment', () => {
    it('rejects payments on unfinished tickets', async () => {
      mockDb.query.ticket.findFirst
        .mockResolvedValueOnce({
          ...writableTicket,
          finished: false,
        })
        .mockResolvedValueOnce({
          ...writableTicket,
          finished: false,
        });

      const result = await applyTicketPayment(42, 10);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('TC007');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('rejects payments when the ticket is already fully paid', async () => {
      mockDb.query.ticket.findFirst
        .mockResolvedValueOnce({
          ...writableTicket,
          paid: 100,
        })
        .mockResolvedValueOnce({
          ...writableTicket,
          paid: 100,
        });

      const result = await applyTicketPayment(42, 10);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('TC007');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('caps partial payments at the remaining balance', async () => {
      mockDb.query.ticket.findFirst
        .mockResolvedValueOnce(writableTicket)
        .mockResolvedValueOnce(writableTicket);

      const updatedRow = { ...writableTicket, paid: 100 };
      mockDb.transaction.mockImplementation(async (callback) => {
        const tx = {
          // Advisory lock acquisition (pg_advisory_xact_lock).
          execute: jest.fn(async () => ({ rows: [] })),
          // Authoritative re-read performed inside the locked transaction.
          query: {
            ticket: {
              findFirst: jest.fn(async () => writableTicket),
            },
          },
          insert: jest.fn(() => ({
            values: jest.fn(async () => []),
          })),
          update: jest.fn(() => ({
            set: jest.fn(() => ({
              where: jest.fn(() => ({
                returning: jest.fn(async () => [updatedRow]),
              })),
            })),
          })),
        };
        return callback(tx);
      });

      const result = await applyTicketPayment(42, 80);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedRow);
      expect(mockRecordTicketAudit).toHaveBeenCalledWith(
        expect.anything(),
        authContext,
        42n,
        10,
        'payment_collected',
        expect.objectContaining({
          payment: {
            requestedAmount: 80,
            appliedAmount: 60,
          },
        }),
      );
    });
  });

  describe('finishTicket', () => {
    it('rejects finishing an already finished ticket', async () => {
      mockDb.query.ticket.findFirst
        .mockResolvedValueOnce({
          ...writableTicket,
          finished: true,
        })
        .mockResolvedValueOnce({
          ...writableTicket,
          finished: true,
        });

      const result = await finishTicket(42, 100, 100);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('TC006');
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('marks the ticket finished and records initial payment', async () => {
      mockDb.query.ticket.findFirst
        .mockResolvedValueOnce({
          ...writableTicket,
          finished: false,
        })
        .mockResolvedValueOnce({
          ...writableTicket,
          finished: false,
        });

      const finishedRow = {
        ...writableTicket,
        finished: true,
        total: 100,
        paid: 25,
      };

      mockDb.transaction.mockImplementation(async (callback) => {
        const tx = {
          update: jest.fn(() => ({
            set: jest.fn(() => ({
              where: jest.fn(() => ({
                returning: jest.fn(async () => [finishedRow]),
              })),
            })),
          })),
          insert: jest.fn(() => ({
            values: jest.fn(async () => []),
          })),
        };
        return callback(tx);
      });

      const result = await finishTicket(42, 100, 25);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(finishedRow);
      expect(mockRecordTicketAudit).toHaveBeenCalledWith(
        expect.anything(),
        authContext,
        42n,
        10,
        'finished',
        expect.objectContaining({
          initialPayment: 25,
        }),
      );
    });
  });
});

describe('ticket actions — read guard wiring', () => {
  it('requireTicketRead is exported for list/detail loaders', async () => {
    (requireTicketRead as jest.Mock).mockResolvedValueOnce({
      context: authContext,
      companyId: 10,
    });

    await requireTicketRead(10);
    expect(requireTicketRead).toHaveBeenCalledWith(10);
  });
});

describe('cross-tenant IDOR — ticket actions', () => {
  const crossTenantError = new AuthorizationError(
    'Access denied to requested company',
  );

  const createTicketPayload = {
    client_id: 1,
    client_name: 'Cliente',
    client_tel: '5551234567',
    email: 'cliente@example.com',
    document: 'ABC123',
    ticket_date: new Date('2026-01-01T00:00:00.000Z'),
    services: [{ service_id: 1, quantity: 1, price: 100 }],
    company_id: IDOR_COMPANY_A.id,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockRequireTicketRead.mockRejectedValue(crossTenantError);
    mockRequireTicketWrite.mockRejectedValue(crossTenantError);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('getTicketById denies cross-tenant requested company context', async () => {
    const result = await getTicketById(
      IDOR_RESOURCES_A.ticketId,
      IDOR_COMPANY_A.id,
    );

    expect(result.success).toBe(false);
    expect(mockRequireTicketRead).toHaveBeenCalledWith(IDOR_COMPANY_A.id);
  });

  it('updateTicket denies cross-tenant requested company context', async () => {
    const result = await updateTicket(IDOR_RESOURCES_A.ticketId, {
      client_name: 'Updated',
      company_id: IDOR_COMPANY_A.id,
    });

    expect(result.success).toBe(false);
    expect(mockRequireTicketWrite).toHaveBeenCalledWith(IDOR_COMPANY_A.id);
  });

  it('deleteTicket denies cross-tenant access before mutation', async () => {
    const result = await deleteTicket(IDOR_RESOURCES_A.ticketId);

    expect(result.success).toBe(false);
    expect(mockRequireTicketWrite).toHaveBeenCalledWith();
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('finishTicket denies cross-tenant access before mutation', async () => {
    const result = await finishTicket(IDOR_RESOURCES_A.ticketId, 100, 50);

    expect(result.success).toBe(false);
    expect(mockRequireTicketWrite).toHaveBeenCalledWith();
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('applyTicketPayment denies cross-tenant access before mutation', async () => {
    const result = await applyTicketPayment(IDOR_RESOURCES_A.ticketId, 10);

    expect(result.success).toBe(false);
    expect(mockRequireTicketWrite).toHaveBeenCalledWith();
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('getTicketAuditHistory denies cross-tenant access before lookup', async () => {
    const result = await getTicketAuditHistory(IDOR_RESOURCES_A.ticketId);

    expect(result.success).toBe(false);
    expect(mockRequireTicketRead).toHaveBeenCalledWith();
    expect(mockDb.query.ticket.findFirst).not.toHaveBeenCalled();
  });

  it('getTickets denies cross-tenant requested company context', async () => {
    const result = await getTickets(IDOR_COMPANY_A.id);

    expect(result.success).toBe(false);
    expect(mockRequireTicketRead).toHaveBeenCalledWith(IDOR_COMPANY_A.id);
  });

  it('createTicket denies cross-tenant requested company context', async () => {
    const result = await createTicket(createTicketPayload);

    expect(result.success).toBe(false);
    expect(mockRequireTicketWrite).toHaveBeenCalledWith(IDOR_COMPANY_A.id);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });
});
