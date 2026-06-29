import { GET } from '@/app/api/clients/[clientId]/route';
import { requireApiPermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import {
  IDOR_COMPANY_A,
  IDOR_RESOURCES_A,
  mockSelectChain,
  mockTenantBCrossTenantDenied,
  mockTenantBAllowed,
  makeGetRequest,
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
  db: { select: jest.fn() },
}));

const mockRequireApiPermission = requireApiPermission as jest.MockedFunction<
  typeof requireApiPermission
>;
const mockDb = db as unknown as {
  select: jest.Mock;
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
});
