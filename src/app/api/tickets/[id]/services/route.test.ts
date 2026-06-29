import { GET, POST } from '@/app/api/tickets/[id]/services/route';
import { requireApiPermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import {
  IDOR_COMPANY_A,
  IDOR_COMPANY_B,
  IDOR_RESOURCES_A,
  makeGetRequest,
  makeIdContext,
  makeJsonRequest,
  mockTenantBCrossTenantDenied,
  mockTenantBAllowed,
} from '@/test/cross-tenant-helpers';

jest.mock('@/lib/api-helpers', () => ({
  ok: jest.fn((data, status = 200) => ({ body: { success: true, data }, status })),
  fail: jest.fn((code, status = 400, errorType) => ({
    body: { success: false, error: code, errorType },
    status,
  })),
  requireApiPermission: jest.fn(),
}));

jest.mock('@/lib/db', () => ({
  db: {
    query: {
      ticket: { findFirst: jest.fn() },
      servicesTickets: { findMany: jest.fn() },
      service: { findFirst: jest.fn() },
    },
    transaction: jest.fn(),
  },
}));

jest.mock('@/lib/ticket-financials', () => ({
  syncTicketTotal: jest.fn(),
}));

jest.mock('@/lib/ticket-audit', () => ({
  recordTicketAudit: jest.fn(),
}));

const mockRequireApiPermission = requireApiPermission as jest.MockedFunction<
  typeof requireApiPermission
>;
const mockDb = db as unknown as {
  query: {
    ticket: { findFirst: jest.Mock };
    servicesTickets: { findMany: jest.Mock };
  };
  transaction: jest.Mock;
};

const ticketId = String(IDOR_RESOURCES_A.ticketId);
const ctx = makeIdContext('id', ticketId);

describe('cross-tenant IDOR — /api/tickets/[id]/services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET returns 403 when Company B requests Company A context', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({
      id: BigInt(ticketId),
      company_id: IDOR_COMPANY_A.id,
      deleted_at: null,
      total: 100,
    });
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await GET(
      makeGetRequest(
        `http://localhost/api/tickets/${ticketId}/services?company_id=${IDOR_COMPANY_A.id}`,
      ),
      ctx,
    );

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      'tickets.read',
      IDOR_COMPANY_A.id,
      { route: `/api/tickets/${ticketId}/services`, method: 'GET' },
    );
    expect(mockDb.query.servicesTickets.findMany).not.toHaveBeenCalled();
  });

  it('GET returns 404 when Company B reads foreign Company A ticket id', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBAllowed());
    mockDb.query.ticket.findFirst.mockResolvedValue(undefined);

    const response = await GET(
      makeGetRequest(
        `http://localhost/api/tickets/${ticketId}/services?company_id=${IDOR_COMPANY_B.id}`,
      ),
      ctx,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, error: 'TC008' });
    expect(mockRequireApiPermission).not.toHaveBeenCalled();
  });

  it('POST returns 403 when Company B requests Company A context', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({
      id: BigInt(ticketId),
      company_id: IDOR_COMPANY_A.id,
      deleted_at: null,
      total: 100,
    });
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await POST(
      makeJsonRequest(
        `http://localhost/api/tickets/${ticketId}/services?company_id=${IDOR_COMPANY_A.id}`,
        { service_id: 1, quantity: 1, price: 10 },
      ),
      ctx,
    );

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      'tickets.write',
      IDOR_COMPANY_A.id,
      { route: `/api/tickets/${ticketId}/services`, method: 'POST' },
    );
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('POST returns 404 when Company B writes foreign Company A ticket id', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBAllowed());
    mockDb.query.ticket.findFirst.mockResolvedValue(undefined);

    const response = await POST(
      makeJsonRequest(
        `http://localhost/api/tickets/${ticketId}/services?company_id=${IDOR_COMPANY_B.id}`,
        { service_id: 1, quantity: 1, price: 10 },
      ),
      ctx,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, error: 'TC008' });
    expect(mockRequireApiPermission).not.toHaveBeenCalled();
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });
});
