import { GET, PATCH, DELETE } from '@/app/api/clients/[clientId]/route';
import { requireApiPermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import {
  IDOR_COMPANY_A,
  IDOR_RESOURCES_A,
  mockFindFirstUndefined,
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
  db: { select: jest.fn(), update: jest.fn(), query: { client: { findFirst: jest.fn() } } },
}));
jest.mock('@/lib/resource-audit', () => ({ recordResourceAudit: jest.fn() }));

const mockRequireApiPermission = requireApiPermission as jest.MockedFunction<
  typeof requireApiPermission
>;
const mockDb = db as unknown as {
  select: jest.Mock;
  update: jest.Mock;
  query: { client: { findFirst: jest.Mock } };
};

const clientId = String(IDOR_RESOURCES_A.clientId);
const ctx = makeIdContext('clientId', clientId);

describe('cross-tenant IDOR — /api/clients/[clientId]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET returns 403 when Company B requests Company A context', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await GET(
      makeGetRequest(
        `http://localhost/api/clients/${clientId}?company_id=${IDOR_COMPANY_A.id}`,
      ),
      ctx,
    );

    expect(response.status).toBe(403);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('GET returns 404 when Company B reads Company A client id', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBAllowed());
    const chain = mockSelectChain([]);
    mockDb.select.mockReturnValue(chain);

    const response = await GET(
      makeGetRequest(`http://localhost/api/clients/${clientId}?company_id=20`),
      ctx,
    );

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, error: 'CL006' });
  });

  it('PATCH returns 403 when Company B targets Company A context', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await PATCH(
      makeJsonRequest(`http://localhost/api/clients/${clientId}`, {
        name: 'Updated',
        company_id: IDOR_COMPANY_A.id,
      }, 'PATCH'),
      ctx,
    );

    expect(response.status).toBe(403);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('PATCH returns 404 when Company A client not in tenant scope', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBAllowed());
    mockDb.query.client.findFirst.mockImplementation(mockFindFirstUndefined());
    mockDb.update.mockReturnValue(mockUpdateReturningEmpty());

    const response = await PATCH(
      makeJsonRequest(
        `http://localhost/api/clients/${clientId}?company_id=20`,
        { name: 'Updated', company_id: 20 },
        'PATCH',
      ),
      ctx,
    );

    expect(response.status).toBe(404);
  });

  it('DELETE returns 403 when Company B targets Company A context', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await DELETE(
      makeGetRequest(
        `http://localhost/api/clients/${clientId}?company_id=${IDOR_COMPANY_A.id}`,
      ),
      ctx,
    );

    expect(response.status).toBe(403);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('DELETE returns 404 when Company A client not in tenant scope', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBAllowed());
    mockDb.query.client.findFirst.mockImplementation(mockFindFirstUndefined());
    mockDb.update.mockReturnValue(mockUpdateReturningEmpty());

    const response = await DELETE(
      makeGetRequest(`http://localhost/api/clients/${clientId}?company_id=20`),
      ctx,
    );

    expect(response.status).toBe(404);
  });
});
