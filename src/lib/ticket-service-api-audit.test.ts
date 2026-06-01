import { POST } from '@/app/api/tickets/[id]/services/route';
import {
  DELETE,
  PUT,
} from '@/app/api/tickets/[id]/services/[serviceId]/route';
import { db } from '@/lib/db';
import { requireApiPermission } from '@/lib/api-helpers';
import { syncTicketTotal } from '@/lib/ticket-financials';
import { recordTicketAudit } from '@/lib/ticket-audit';

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      ticket: {
        findFirst: jest.fn(),
      },
      service: {
        findFirst: jest.fn(),
      },
    },
    transaction: jest.fn(),
  },
}));

jest.mock('@/lib/api-helpers', () => ({
  ok: jest.fn((data, status = 200) => ({ body: { success: true, data }, status })),
  fail: jest.fn((code, status = 400, errorType) => ({
    body: { success: false, error: code, errorType },
    status,
  })),
  requireApiPermission: jest.fn(),
}));

jest.mock('@/lib/ticket-financials', () => ({
  syncTicketTotal: jest.fn(),
}));

jest.mock('@/lib/ticket-audit', () => ({
  recordTicketAudit: jest.fn(),
}));

const mockDb = db as unknown as {
  query: {
    ticket: { findFirst: jest.Mock };
    service: { findFirst: jest.Mock };
  };
  transaction: jest.Mock;
};
const mockRequireApiPermission =
  requireApiPermission as jest.MockedFunction<typeof requireApiPermission>;
const mockSyncTicketTotal = syncTicketTotal as jest.MockedFunction<
  typeof syncTicketTotal
>;
const mockRecordTicketAudit = recordTicketAudit as jest.MockedFunction<
  typeof recordTicketAudit
>;

const session = {
  user: {
    id: '7',
    company_id: 1,
    company_is_system: true,
  },
};

const ticketRow = {
  id: BigInt(42),
  company_id: 2,
  total: 100,
  deleted_at: null,
};

const serviceSnapshot = {
  id: 9,
  ticket_id: BigInt(42),
  service_id: 20,
  quantity: 2,
  price: 15,
  deleted_at: null,
  service: {
    id: 20,
    name: 'Lavado',
  },
};

const makeRequest = (body?: Record<string, unknown>) =>
  ({
    json: async () => body,
  }) as Request;

describe('ticket service API auditing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.query.ticket.findFirst.mockResolvedValue(ticketRow);
    mockRequireApiPermission.mockResolvedValue({
      session: session as Awaited<
        ReturnType<typeof requireApiPermission>
      >['session'],
      companyId: 2,
      unauthorized: null,
    });
    mockSyncTicketTotal.mockResolvedValue(130);
    mockRecordTicketAudit.mockResolvedValue(undefined);
  });

  it('dual-writes audit rows when adding a service through the API', async () => {
    mockDb.query.service.findFirst.mockResolvedValue({
      id: 20,
      company_id: 2,
      name: 'Lavado',
      deleted_at: null,
    });
    const tx = {
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn().mockResolvedValue([serviceSnapshot]),
        })),
      })),
      query: {
        servicesTickets: {
          findFirst: jest.fn().mockResolvedValue(serviceSnapshot),
        },
      },
    };
    mockDb.transaction.mockImplementation(async (callback) => callback(tx));

    await POST(makeRequest({ service_id: 20, quantity: 2, price: 15 }), {
      params: Promise.resolve({ id: '42' }),
    });

    expect(mockRecordTicketAudit).toHaveBeenCalledWith(
      tx,
      {
        userId: '7',
        companyId: 1,
        companyIsSystem: true,
      },
      BigInt(42),
      2,
      'updated',
      expect.objectContaining({
        source: 'api',
        mutation: 'ticket_service_added',
        ticket_total: {
          before: 100,
          after: 130,
          delta: 30,
        },
        ticket_service: expect.objectContaining({
          before: null,
          after: expect.objectContaining({
            id: 9,
            service_id: 20,
            service_name: 'Lavado',
            line_total: 30,
          }),
        }),
      }),
    );
  });

  it('dual-writes audit rows with before and after values when updating a ticket service', async () => {
    const before = { ...serviceSnapshot, quantity: 1, price: 10 };
    const after = { ...serviceSnapshot, quantity: 3, price: 12 };
    const tx = {
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest.fn().mockResolvedValue([after]),
          })),
        })),
      })),
      query: {
        servicesTickets: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(before)
            .mockResolvedValueOnce(after),
        },
      },
    };
    mockSyncTicketTotal.mockResolvedValue(136);
    mockDb.transaction.mockImplementation(async (callback) => callback(tx));

    await PUT(makeRequest({ quantity: 3, price: 12 }), {
      params: Promise.resolve({ id: '42', serviceId: '9' }),
    });

    expect(mockRecordTicketAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ userId: '7' }),
      BigInt(42),
      2,
      'updated',
      expect.objectContaining({
        mutation: 'ticket_service_updated',
        ticket_service: {
          before: expect.objectContaining({ quantity: 1, price: 10 }),
          after: expect.objectContaining({ quantity: 3, price: 12 }),
        },
        ticket_total: {
          before: 100,
          after: 136,
          delta: 36,
        },
      }),
    );
  });

  it('dual-writes audit rows with deletion context when removing a ticket service', async () => {
    const deletedAt = new Date('2026-05-31T12:00:00.000Z');
    const tx = {
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            returning: jest
              .fn()
              .mockResolvedValue([{ ...serviceSnapshot, deleted_at: deletedAt }]),
          })),
        })),
      })),
      query: {
        servicesTickets: {
          findFirst: jest.fn().mockResolvedValue(serviceSnapshot),
        },
      },
    };
    mockSyncTicketTotal.mockResolvedValue(70);
    mockDb.transaction.mockImplementation(async (callback) => callback(tx));

    await DELETE(makeRequest(), {
      params: Promise.resolve({ id: '42', serviceId: '9' }),
    });

    expect(mockRecordTicketAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ userId: '7' }),
      BigInt(42),
      2,
      'updated',
      expect.objectContaining({
        mutation: 'ticket_service_removed',
        ticket_service: {
          before: expect.objectContaining({ deleted_at: null }),
          after: expect.objectContaining({ deleted_at: deletedAt }),
        },
        ticket_total: {
          before: 100,
          after: 70,
          delta: -30,
        },
      }),
    );
  });
});
