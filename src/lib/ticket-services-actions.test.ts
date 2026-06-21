import { getTicketServices } from '@/actions/ticket-services';
import { db } from '@/lib/db';
import { requireActionPermission } from '@/lib/security';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      ticket: {
        findFirst: jest.fn(),
      },
      servicesTickets: {
        findMany: jest.fn(),
      },
    },
  },
}));

jest.mock('@/lib/security', () => ({
  requireActionPermission: jest.fn(),
}));

const mockDb = db as unknown as {
  query: {
    ticket: {
      findFirst: jest.Mock;
    };
    servicesTickets: {
      findMany: jest.Mock;
    };
  };
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
