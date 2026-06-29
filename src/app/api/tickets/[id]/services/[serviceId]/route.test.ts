import { DELETE, PUT } from '@/app/api/tickets/[id]/services/[serviceId]/route';
import { requireApiPermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import {
  IDOR_COMPANY_A,
  IDOR_COMPANY_B,
  IDOR_RESOURCES_A,
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
      servicesTickets: { findFirst: jest.fn() },
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
  };
  transaction: jest.Mock;
};

const ticketId = String(IDOR_RESOURCES_A.ticketId);
const serviceId = String(IDOR_RESOURCES_A.serviceId);
const ctx = makeIdContext('id', ticketId) as {
  params: Promise<{ id: string; serviceId: string }>;
};
ctx.params = Promise.resolve({ id: ticketId, serviceId });

describe('cross-tenant IDOR — /api/tickets/[id]/services/[serviceId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('PUT returns 403 when Company B requests Company A context', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({
      id: BigInt(ticketId),
      company_id: IDOR_COMPANY_A.id,
      deleted_at: null,
      total: 100,
    });
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await PUT(
      makeJsonRequest(
        `http://localhost/api/tickets/${ticketId}/services/${serviceId}?company_id=${IDOR_COMPANY_A.id}`,
        { quantity: 2, price: 50 },
        'PUT',
      ),
      ctx,
    );

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      'tickets.write',
      IDOR_COMPANY_A.id,
      { route: `/api/tickets/${ticketId}/services/[serviceId]`, method: 'PUT' },
    );
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('PUT returns 404 when Company B updates foreign Company A ticket id', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBAllowed());
    mockDb.query.ticket.findFirst.mockResolvedValue(undefined);

    const response = await PUT(
      makeJsonRequest(
        `http://localhost/api/tickets/${ticketId}/services/${serviceId}?company_id=${IDOR_COMPANY_B.id}`,
        { quantity: 2, price: 50 },
        'PUT',
      ),
      ctx,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, error: 'TC008' });
    expect(mockRequireApiPermission).not.toHaveBeenCalled();
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('DELETE returns 403 when Company B requests Company A context', async () => {
    mockDb.query.ticket.findFirst.mockResolvedValue({
      id: BigInt(ticketId),
      company_id: IDOR_COMPANY_A.id,
      deleted_at: null,
      total: 100,
    });
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await DELETE(
      makeJsonRequest(
        `http://localhost/api/tickets/${ticketId}/services/${serviceId}?company_id=${IDOR_COMPANY_A.id}`,
        {},
        'DELETE',
      ),
      ctx,
    );

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      'tickets.write',
      IDOR_COMPANY_A.id,
      { route: `/api/tickets/${ticketId}/services/[serviceId]`, method: 'DELETE' },
    );
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('DELETE returns 404 when Company B deletes foreign Company A ticket id', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBAllowed());
    mockDb.query.ticket.findFirst.mockResolvedValue(undefined);

    const response = await DELETE(
      makeJsonRequest(
        `http://localhost/api/tickets/${ticketId}/services/${serviceId}?company_id=${IDOR_COMPANY_B.id}`,
        {},
        'DELETE',
      ),
      ctx,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, error: 'TC008' });
    expect(mockRequireApiPermission).not.toHaveBeenCalled();
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });
});
