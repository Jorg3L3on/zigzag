import { anotarCapture } from '@/actions/anotar';
import { db } from '@/lib/db';
import { recordTicketAudit } from '@/lib/ticket-audit';
import { syncTicketTotal } from '@/lib/ticket-financials';
import { requireTicketWrite } from '@/lib/tickets-rbac-server';

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      client: {
        findFirst: jest.fn(),
      },
      service: {
        findFirst: jest.fn(),
      },
    },
    transaction: jest.fn(),
    execute: jest.fn(),
  },
}));

jest.mock('@/lib/tickets-rbac-server', () => ({
  requireTicketWrite: jest.fn(),
}));

jest.mock('@/lib/ticket-audit', () => ({
  recordTicketAudit: jest.fn(),
}));

jest.mock('@/lib/ticket-financials', () => ({
  syncTicketTotal: jest.fn(),
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/cache', () => ({
  invalidateCompanyCache: jest.fn(),
}));

const mockDb = db as unknown as {
  query: {
    client: { findFirst: jest.Mock };
    service: { findFirst: jest.Mock };
  };
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

describe('anotarCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireTicketWrite.mockResolvedValue({
      context: authContext,
      companyId: 10,
    });
    mockRecordTicketAudit.mockResolvedValue(undefined);
    mockDb.query.client.findFirst.mockResolvedValue({ id: 5 });
    mockSyncTicketTotal.mockResolvedValue(250);
  });

  it('creates, finishes, and returns the ticket id on the happy path', async () => {
    const createdRow = {
      id: 99n,
      company_id: 10,
      finished: false,
      total: 0,
      paid: 0,
    };
    const finishedRow = {
      ...createdRow,
      finished: true,
      total: 250,
      paid: 100,
    };

    mockDb.transaction.mockImplementation(async (callback) => {
      const tx = {
        insert: jest
          .fn()
          .mockReturnValueOnce({
            values: jest.fn(() => ({
              returning: jest.fn(async () => [createdRow]),
            })),
          })
          .mockReturnValueOnce({
            values: jest.fn(async () => []),
          })
          .mockReturnValueOnce({
            values: jest.fn(async () => []),
          }),
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(() => ({
              returning: jest.fn(async () => [finishedRow]),
            })),
          })),
        })),
        execute: jest.fn(async () => ({ rows: [] })),
        query: {
          service: {
            findFirst: jest.fn(async () => ({ id: 7 })),
          },
        },
      };
      return callback(tx);
    });

    const result = await anotarCapture({
      client_id: 5,
      client_name: 'Cliente Demo',
      client_tel: '5550001111',
      work_notes: 'Reparación de fuga',
      total: 250,
      paid: 100,
      company_id: 10,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: '99' });
    expect(mockRequireTicketWrite).toHaveBeenCalledWith(10);
    expect(mockSyncTicketTotal).toHaveBeenCalled();
    expect(mockRecordTicketAudit).toHaveBeenCalledTimes(2);
  });

  it('returns TC009 when paid exceeds total', async () => {
    const result = await anotarCapture({
      client_name: 'Cliente Demo',
      client_tel: '5550001111',
      total: 100,
      paid: 150,
      company_id: 10,
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TC009');
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });
});
