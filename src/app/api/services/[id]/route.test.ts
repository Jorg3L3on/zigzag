import { GET, PUT, DELETE } from '@/app/api/services/[id]/route';
import { requireApiPermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import {
  IDOR_COMPANY_A,
  IDOR_RESOURCES_A,
  mockSelectChain,
  mockTenantBCrossTenantDenied,
  mockTenantBAllowed,
  mockUpdateReturningEmpty,
  makeGetRequest,
  makeJsonRequest,
  makeIdContext,
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
  db: { select: jest.fn(), update: jest.fn(), query: { service: { findFirst: jest.fn() } } },
}));
jest.mock('@/lib/resource-audit', () => ({ recordResourceAudit: jest.fn() }));

const mockRequireApiPermission = requireApiPermission as jest.MockedFunction<
  typeof requireApiPermission
>;
const mockDb = db as unknown as { select: jest.Mock; update: jest.Mock };

const serviceId = String(IDOR_RESOURCES_A.serviceId);
const ctx = makeIdContext('id', serviceId);

describe('cross-tenant IDOR — /api/services/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET returns 403 when Company B requests Company A context', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await GET(
      makeGetRequest(
        `http://localhost/api/services/${serviceId}?company_id=${IDOR_COMPANY_A.id}`,
      ),
      ctx,
    );

    expect(response.status).toBe(403);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('GET returns 404 when Company A service not visible to Company B', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBAllowed());
    mockDb.select.mockReturnValue(mockSelectChain([]));

    const response = await GET(
      makeGetRequest(`http://localhost/api/services/${serviceId}?company_id=20`),
      ctx,
    );

    expect(response.status).toBe(404);
  });

  it('PUT returns 403 when Company B targets Company A context', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await PUT(
      makeJsonRequest(`http://localhost/api/services/${serviceId}`, {
        name: 'Svc',
        description: 'D',
        price: 1,
        company_id: IDOR_COMPANY_A.id,
      }, 'PUT'),
      ctx,
    );

    expect(response.status).toBe(403);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('PUT returns 404 when service not in tenant scope', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBAllowed());
    mockDb.update.mockReturnValue(mockUpdateReturningEmpty());

    const response = await PUT(
      makeJsonRequest(
        `http://localhost/api/services/${serviceId}?company_id=20`,
        { name: 'Svc', description: 'D', price: 1, company_id: 20 },
        'PUT',
      ),
      ctx,
    );

    expect(response.status).toBe(404);
  });

  it('DELETE returns 403 when Company B targets Company A context', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await DELETE(
      makeGetRequest(
        `http://localhost/api/services/${serviceId}?company_id=${IDOR_COMPANY_A.id}`,
      ),
      ctx,
    );

    expect(response.status).toBe(403);
  });

  it('DELETE returns 404 when service not in tenant scope', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBAllowed());
    mockDb.update.mockReturnValue(mockUpdateReturningEmpty());

    const response = await DELETE(
      makeGetRequest(`http://localhost/api/services/${serviceId}?company_id=20`),
      ctx,
    );

    expect(response.status).toBe(404);
  });
});
