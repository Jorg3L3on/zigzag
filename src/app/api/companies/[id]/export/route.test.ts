import { GET } from '@/app/api/companies/[id]/export/route';
import { requireApiPermission } from '@/lib/api-helpers';
import { buildCompanyExportBundle } from '@/lib/company-export';
import { IDOR_COMPANY_A, mockTenantBCrossTenantDenied, makeGetRequest, makeIdContext } from '@/test/cross-tenant-helpers';

jest.mock('@/lib/api-helpers', () => ({
  fail: jest.fn((code, status = 400, errorType) => ({
    body: { success: false, error: code, errorType },
    status,
  })),
  requireApiPermission: jest.fn(),
}));

jest.mock('@/lib/company-export', () => ({
  buildCompanyExportBundle: jest.fn(),
  serializeCompanyExportBundle: jest.fn(() => '{"ok":true}'),
}));
jest.mock('@/lib/db', () => ({ db: { query: { user: { findFirst: jest.fn() } } } }));
jest.mock('@/lib/governance-audit', () => ({
  recordGovernanceAudit: jest.fn(),
  sessionUserToGovernanceActor: jest.fn(),
}));

const mockRequireApiPermission = requireApiPermission as jest.MockedFunction<
  typeof requireApiPermission
>;
const mockBuildCompanyExportBundle = buildCompanyExportBundle as jest.MockedFunction<
  typeof buildCompanyExportBundle
>;

describe('cross-tenant IDOR - /api/companies/[id]/export', () => {
  beforeEach(() => jest.clearAllMocks());

  it('GET denies tenant B when targeting company A export', async () => {
    mockRequireApiPermission.mockResolvedValue(mockTenantBCrossTenantDenied());

    const response = await GET(
      makeGetRequest(`http://localhost/api/companies/${IDOR_COMPANY_A.id}/export`),
      makeIdContext('id', String(IDOR_COMPANY_A.id)),
    );

    expect(response.status).toBe(403);
    expect(mockRequireApiPermission).toHaveBeenCalledWith(
      'companies.read',
      IDOR_COMPANY_A.id,
    );
    expect(mockBuildCompanyExportBundle).not.toHaveBeenCalled();
  });
});
