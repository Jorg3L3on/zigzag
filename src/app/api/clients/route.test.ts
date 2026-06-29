import { GET, POST } from '@/app/api/clients/route';
import { requireApiPermission } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import {
  IDOR_COMPANY_A,
  mockSelectChain,
  mockTenantBCrossTenantDenied,
  mockTenantBAllowed,
  makeGetRequest,
  makeJsonRequest,
} from '@/test/cross-tenant-helpers';

jest.mock('@/lib/api-helpers', () => ({
  ok: jest.fn((data, status = 200) => ({ body: { success: true, data }, status })),
  fail: jest.fn((code, status = 400, errorType) => ({
    body: { success: false, error: code, errorType },
    status,
  })),
  requireApiPermission: jest.fn(),
}));

jest.mock('@/lib/db', () => ({ db: { select: jest.fn(), insert: jest.fn() } }));
jest.mock('@/lib/resource-audit', () => ({ recordResourceAudit: jest.fn() }));
jest.mock('@/lib/company-entitlement-guard', () => ({
  assertCompanyEntitlementAllows: jest.fn(),
  CompanyEntitlementExceededError: class extends Error {},
}));

const mockRequireApiPermission = requireApiPermission as jest.MockedFunction<
  typeof requireApiPermission
>;
const mockDb = db as unknown as { select: jest.Mock; insert: jest.Mock };

describe('cross-tenant IDOR — /api/clients', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET denies Company B user requesting Company A list context', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await GET(
      makeGetRequest(`http://localhost/api/clients?company_id=${IDOR_COMPANY_A.id}`),
    );

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      'clients.read',
      IDOR_COMPANY_A.id,
    );
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('POST denies Company B user creating in Company A', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await POST(
      makeJsonRequest('http://localhost/api/clients', {
        name: 'Foreign',
        company_id: IDOR_COMPANY_A.id,
      }),
    );

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      'clients.write',
      IDOR_COMPANY_A.id,
      { route: '/api/clients', method: 'POST' },
    );
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('GET scopes list to authorized tenant company', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBAllowed());
    const chain = mockSelectChain([]);
    mockDb.select.mockReturnValue(chain);

    await GET(makeGetRequest('http://localhost/api/clients?company_id=20'));

    expect(mockDb.select).toHaveBeenCalled();
  });
});
